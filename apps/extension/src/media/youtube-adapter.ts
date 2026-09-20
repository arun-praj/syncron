// Controls YouTube's own native <video> element directly — this content
// script shares the page's DOM (not a cross-origin iframe), so there's no
// need for YouTube's IFrame Player API. Read-only snapshot reading used to
// live in lib/page-playback.ts; this supersedes it for room screens by
// adding real control (play/pause/seek/rate) and local-change detection.

export interface MediaSnapshot {
  mediaId: string | null;
  url: string;
  position: number;
  paused: boolean;
  playbackRate: number;
  title: string;
  muted: boolean;
  volume: number;
}

export interface RemotePlaybackState {
  position: number;
  paused: boolean;
  playbackRate: number;
  muted: boolean;
  volume: number;
  // Server clock ms this position was authoritative at — lets a still-
  // playing state's position be projected forward instead of constantly
  // re-seeking to a slightly-stale value.
  updatedAt: number;
  serverNow?: number;
}

export type LocalMediaEvent =
  | { type: "play" | "pause" | "seek" | "ratechange" | "audiochange"; snapshot: MediaSnapshot }
  | { type: "mediaChange"; snapshot: MediaSnapshot }
  | { type: "navigationBlocked"; attemptedUrl: string }
  | { type: "buffering"; buffering: boolean; position: number }
  | { type: "autoplayBlocked"; blocked: boolean };

type ControlEventType = "play" | "pause" | "seek" | "ratechange" | "audiochange";

// How far local and server-projected position may drift before a running
// video is corrected — avoids visibly jittering the playhead for normal
// network jitter.
const DRIFT_CORRECTION_SECONDS = 0.01;
const HARD_SEEK_DRIFT_SECONDS = 0.25;
const MAX_RATE_CORRECTION = 0.05;
const CORRECTION_INTERVAL_MS = 100;
const REMOTE_EVENT_WINDOW_MS = 1000;
const ATTACH_RETRY_MS = 500;
const AUDIO_CHANGE_DEBOUNCE_MS = 50;

function currentMediaId(): string | null {
  try {
    return new URL(location.href).searchParams.get("v");
  } catch {
    return null;
  }
}

function currentTitle(): string {
  return document.title.replace(/ - YouTube$/, "");
}

export class YoutubeMediaAdapter {
  private video: HTMLVideoElement | null = null;
  private videoListeners: Array<[string, EventListener]> = [];
  private remoteEventUntil = 0;
  private readonly remoteEventTypes = new Set<ControlEventType>();
  private remoteState: RemotePlaybackState | null = null;
  private pendingRemoteState: RemotePlaybackState | null = null;
  private remoteAnchor: { position: number; at: number } | null = null;
  private autoplayBlocked = false;
  private correctionTimer: ReturnType<typeof setInterval> | null = null;
  private audioChangeTimer: ReturnType<typeof setTimeout> | null = null;
  private frameRequest: number | null = null;
  private attachRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMediaId: string | null = null;
  private lockedMedia: { mediaId: string | null; url: string } | null = null;
  private stopped = false;
  private readonly listeners = new Set<(event: LocalMediaEvent) => void>();
  private readonly onNavigate = () => this.handleNavigation();
  private readonly onUserInteraction = () => {
    if (this.autoplayBlocked && this.remoteState) {
      this.autoplayBlocked = false;
      this.pendingRemoteState = this.remoteState;
      this.applyPendingRemote();
    }
  };
  private readonly onVisibilityChange = () => {
    if (!document.hidden) {
      this.applyPendingRemote();
      this.correctDrift();
    }
  };

  start(): void {
    this.stopped = false;
    this.lastMediaId = currentMediaId();
    window.addEventListener("yt-navigate-finish", this.onNavigate);
    document.addEventListener("pointerdown", this.onUserInteraction, true);
    document.addEventListener("keydown", this.onUserInteraction, true);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.attach();
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener("yt-navigate-finish", this.onNavigate);
    document.removeEventListener("pointerdown", this.onUserInteraction, true);
    document.removeEventListener("keydown", this.onUserInteraction, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.attachRetryTimer) clearTimeout(this.attachRetryTimer);
    if (this.correctionTimer) clearInterval(this.correctionTimer);
    if (this.audioChangeTimer) clearTimeout(this.audioChangeTimer);
    if (this.frameRequest !== null) {
      const video = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null;
      video?.cancelVideoFrameCallback?.(this.frameRequest);
    }
    this.correctionTimer = null;
    this.audioChangeTimer = null;
    this.frameRequest = null;
    this.detach();
    this.pendingRemoteState = null;
    this.remoteState = null;
    this.remoteAnchor = null;
    this.lockedMedia = null;
    this.remoteEventTypes.clear();
    this.autoplayBlocked = false;
    this.listeners.clear();
  }

  subscribe(listener: (event: LocalMediaEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): MediaSnapshot | null {
    const video = this.video;
    if (!video || Number.isNaN(video.duration)) return null;
    return {
      mediaId: currentMediaId(),
      url: location.href,
      position: video.currentTime,
      paused: video.paused,
      playbackRate: video.playbackRate,
      title: currentTitle(),
      muted: video.muted,
      volume: video.volume,
    };
  }

  lockToCurrentMedia(): void {
    const snapshot = this.getSnapshot();
    this.lockedMedia = {
      mediaId: snapshot?.mediaId ?? currentMediaId(),
      url: snapshot?.url ?? location.href,
    };
  }

  lockToMedia(mediaId: string | null, url: string): void {
    this.lockedMedia = { mediaId, url };
    if (!this.isLockedMedia()) this.restoreLockedMedia();
  }

  // Applies authoritative server state without re-emitting it as a local
  // control event — the caller (playback-sync controller) decides when
  // this is warranted (a genuinely new state, or periodic drift check).
  applyRemote(state: RemotePlaybackState): void {
    this.remoteEventTypes.clear();
    this.remoteState = state;
    this.pendingRemoteState = state;
    this.remoteAnchor = {
      position: state.paused
        ? state.position
        : state.position + Math.max(0, (state.serverNow ?? Date.now()) - state.updatedAt) / 1000,
      at: performance.now(),
    };
    this.applyPendingRemote();
  }

  private applyPendingRemote(): void {
    const video = this.video;
    const state = this.pendingRemoteState;
    if (!video || !state || Number.isNaN(video.duration)) return;
    this.pendingRemoteState = null;
    this.remoteEventUntil = Date.now() + REMOTE_EVENT_WINDOW_MS;
    this.applyAudio(state);
    this.correctDrift();
  }

  private projectedPosition(): number | null {
    const state = this.remoteState;
    const anchor = this.remoteAnchor;
    if (!state || !anchor) return null;
    return state.paused ? anchor.position : anchor.position + (performance.now() - anchor.at) / 1000;
  }

  private applyAudio(state: RemotePlaybackState): void {
    const video = this.video;
    if (!video) return;
    if (video.volume !== state.volume) {
      this.markRemoteChange("audiochange");
      video.volume = state.volume;
    }
    if (video.muted !== state.muted) {
      this.markRemoteChange("audiochange");
      video.muted = state.muted;
    }
  }

  private correctDrift(): void {
    const video = this.video;
    const state = this.remoteState;
    const anchor = this.remoteAnchor;
    if (!video || !state || !anchor || Number.isNaN(video.duration)) return;

    const target = this.projectedPosition();
    if (target === null) return;
    this.applyAudio(state);

    if (state.paused) {
      if (!video.paused) {
        this.markRemoteChange("pause");
        video.pause();
      }
      if (Math.abs(video.currentTime - target) > DRIFT_CORRECTION_SECONDS) {
        this.markRemoteChange("seek");
        video.currentTime = target;
      }
      if (video.playbackRate !== state.playbackRate) {
        this.markRemoteChange("ratechange");
        video.playbackRate = state.playbackRate;
      }
      return;
    }

    const drift = target - video.currentTime;
    const hardSeek = Math.abs(drift) > HARD_SEEK_DRIFT_SECONDS;
    if (hardSeek) {
      this.markRemoteChange("seek");
      video.currentTime = target;
    }
    const correction = Math.max(-MAX_RATE_CORRECTION, Math.min(MAX_RATE_CORRECTION, drift * 0.5));
    const desiredRate = !hardSeek && Math.abs(drift) > DRIFT_CORRECTION_SECONDS
      ? Math.max(0.25, Math.min(4, state.playbackRate + correction))
      : state.playbackRate;
    if (video.playbackRate !== desiredRate) {
      this.markRemoteChange("ratechange");
      video.playbackRate = desiredRate;
    }
    if (video.paused) {
      if (this.autoplayBlocked) return;
      this.markRemoteChange("play");
      void video.play().then(() => {
        if (this.autoplayBlocked) {
          this.autoplayBlocked = false;
          this.notify({ type: "autoplayBlocked", blocked: false });
        }
      }).catch(() => {
        this.pendingRemoteState = this.remoteState;
        if (!this.autoplayBlocked) {
          this.autoplayBlocked = true;
          this.notify({ type: "autoplayBlocked", blocked: true });
        }
      });
    }
  }

  private markRemoteChange(type: ControlEventType): void {
    this.remoteEventTypes.add(type);
    this.remoteEventUntil = Date.now() + REMOTE_EVENT_WINDOW_MS;
  }

  private attach(): void {
    if (this.stopped) return;
    this.detach();
    const video = document.querySelector("video");
    if (!video) {
      this.attachRetryTimer = setTimeout(() => this.attach(), ATTACH_RETRY_MS);
      return;
    }
    this.video = video;
    const on = (name: string, fn: EventListener) => {
      video.addEventListener(name, fn);
      this.videoListeners.push([name, fn]);
    };
    on("play", () => this.emitControlEvent("play"));
    on("pause", () => this.emitControlEvent("pause"));
    on("seeked", () => this.emitControlEvent("seek"));
    on("ratechange", () => this.emitControlEvent("ratechange"));
    on("volumechange", () => this.emitAudioChange());
    on("waiting", () => this.emitBuffering(true));
    on("playing", () => {
      this.applyPendingRemote();
      this.correctDrift();
      this.emitBuffering(false);
    });
    on("loadedmetadata", () => this.applyPendingRemote());
    on("durationchange", () => this.applyPendingRemote());
    on("canplay", () => this.applyPendingRemote());
    on("pointerdown", () => this.applyPendingRemote());
    if (!video.requestVideoFrameCallback) {
      this.correctionTimer = setInterval(() => this.correctDrift(), CORRECTION_INTERVAL_MS);
    }
    this.applyPendingRemote();
    this.scheduleFrameCorrection();
  }

  private detach(): void {
    if (this.frameRequest !== null) {
      const video = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null;
      video?.cancelVideoFrameCallback?.(this.frameRequest);
      this.frameRequest = null;
    }
    if (this.video) {
      for (const [name, fn] of this.videoListeners) this.video.removeEventListener(name, fn);
    }
    this.videoListeners = [];
    if (this.audioChangeTimer) clearTimeout(this.audioChangeTimer);
    this.audioChangeTimer = null;
    if (this.correctionTimer) clearInterval(this.correctionTimer);
    this.correctionTimer = null;
    this.video = null;
  }

  private scheduleFrameCorrection(): void {
    const video = this.video as (HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    }) | null;
    if (!video?.requestVideoFrameCallback || this.stopped) return;
    this.frameRequest = video.requestVideoFrameCallback(() => {
      this.frameRequest = null;
      this.correctDrift();
      this.scheduleFrameCorrection();
    });
  }

  private handleNavigation(): void {
    const mediaId = currentMediaId();
    if (mediaId === this.lastMediaId) return;
    this.lastMediaId = mediaId;
    if (this.lockedMedia && !this.isLockedMedia()) {
      this.notify({ type: "navigationBlocked", attemptedUrl: location.href });
      this.restoreLockedMedia();
      return;
    }
    this.attach();
    // The new page's <video> element takes a moment to report real
    // duration/currentTime — wait a beat before snapshotting it.
    setTimeout(() => {
      const snapshot = this.getSnapshot();
      if (snapshot) this.notify({ type: "mediaChange", snapshot });
    }, 300);
  }

  private isLockedMedia(): boolean {
    const locked = this.lockedMedia;
    if (!locked) return true;
    if (locked.mediaId !== null || currentMediaId() !== null)
      return locked.mediaId === currentMediaId();
    return location.href === locked.url;
  }

  private restoreLockedMedia(): void {
    const locked = this.lockedMedia;
    if (!locked || this.isLockedMedia() || this.stopped) return;
    window.setTimeout(() => {
      if (!this.stopped && !this.isLockedMedia()) window.location.replace(locked.url);
    }, 0);
  }

  private emitControlEvent(type: ControlEventType): void {
    if (this.matchesRemoteState(type)) return;
    const snapshot = this.getSnapshot();
    if (!snapshot) return;
    this.notify({ type, snapshot });
  }

  private emitAudioChange(): void {
    if (this.audioChangeTimer) clearTimeout(this.audioChangeTimer);
    this.audioChangeTimer = setTimeout(() => {
      this.audioChangeTimer = null;
      this.emitControlEvent("audiochange");
    }, AUDIO_CHANGE_DEBOUNCE_MS);
  }

  private matchesRemoteState(type: ControlEventType): boolean {
    const video = this.video;
    const state = this.remoteState;
    const target = this.projectedPosition();
    if (!video || !state || target === null || !this.remoteEventTypes.has(type) || Date.now() > this.remoteEventUntil) return false;
    const matches = type === "play" || type === "pause"
      ? video.paused === state.paused
      : type === "ratechange"
        ? Math.abs(video.playbackRate - state.playbackRate) <= MAX_RATE_CORRECTION
        : type === "audiochange"
          ? video.muted === state.muted && video.volume === state.volume
          : Math.abs(video.currentTime - target) <= HARD_SEEK_DRIFT_SECONDS;
    if (matches) this.remoteEventTypes.delete(type);
    return matches;
  }

  private emitBuffering(buffering: boolean): void {
    if (Date.now() < this.remoteEventUntil) return;
    const video = this.video;
    if (!video) return;
    this.notify({ type: "buffering", buffering, position: video.currentTime });
  }

  private notify(event: LocalMediaEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

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
  | { type: "play" | "pause" | "ratechange" | "audiochange"; snapshot: MediaSnapshot }
  | { type: "seek"; snapshot: MediaSnapshot; paused: boolean }
  | { type: "mediaChange"; snapshot: MediaSnapshot }
  | { type: "navigationBlocked"; attemptedUrl: string }
  | { type: "buffering"; buffering: boolean; position: number }
  | { type: "autoplayBlocked"; blocked: boolean };

type ControlEventType = "play" | "pause" | "seek" | "ratechange" | "audiochange";

// How far local and server-projected position may drift before a running
// video is corrected — avoids visibly jittering the playhead for normal
// network jitter.
const DRIFT_CORRECTION_SECONDS = 0.01;
const DRIFT_CORRECTION_STOP_SECONDS = 0.004;
const HARD_SEEK_DRIFT_SECONDS = 0.25;
const MAX_RATE_CORRECTION = 0.05;
const RATE_CHANGE_MATCH_EPSILON = 0.001;
const CORRECTION_INTERVAL_MS = 100;
const REMOTE_EVENT_WINDOW_MS = 1000;
// YouTube can emit a trailing pause/play while it settles a seek. Keep those
// native events out of the room protocol; the seek event already carries the
// authoritative position and the server coalesces it briefly.
const SEEK_EVENT_SETTLE_MS = 750;
const ATTACH_RETRY_MS = 500;
const AUDIO_CHANGE_DEBOUNCE_MS = 50;

function currentMediaId(): string | null {
  try {
    return new URL(location.href).searchParams.get("v");
  } catch {
    return null;
  }
}

function mediaIdFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
}

function currentTitle(): string {
  return document.title.replace(/ - YouTube$/, "");
}

function youtubeVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("#movie_player video")
    ?? document.querySelector<HTMLVideoElement>("video.html5-main-video")
    ?? document.querySelector<HTMLVideoElement>("video");
}

export class YoutubeMediaAdapter {
  private video: HTMLVideoElement | null = null;
  private videoListeners: Array<[string, EventListener]> = [];
  private remoteEventUntil = 0;
  private readonly remoteEventTypes = new Set<ControlEventType>();
  private remoteRateChangeTarget: number | null = null;
  private remoteState: RemotePlaybackState | null = null;
  private pendingRemoteState: RemotePlaybackState | null = null;
  private remoteAnchor: { position: number; at: number } | null = null;
  private pendingLocalControlUntil = 0;
  private localAudioChangeUntil = 0;
  private applyingRemoteAudio = false;
  private autoplayBlocked = false;
  private correctionActive = false;
  private correctionTimer: ReturnType<typeof setInterval> | null = null;
  private videoWatchTimer: ReturnType<typeof setInterval> | null = null;
  private audioChangeTimer: ReturnType<typeof setTimeout> | null = null;
  private frameRequest: number | null = null;
  private attachRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMediaId: string | null = null;
  private lockedMedia: { mediaId: string | null; url: string } | null = null;
  private allowNextNavigation = false;
  private seeking = false;
  private seekWasPlaying: boolean | null = null;
  private suppressPlaybackEventsUntil = 0;
  private stopped = false;
  private readonly listeners = new Set<(event: LocalMediaEvent) => void>();
  private readonly onNavigate = () => this.handleNavigation();
  private readonly onUserInteraction = () => {
    if (this.autoplayBlocked && this.remoteState) {
      this.autoplayBlocked = false;
      this.reapplyRemote();
    }
  };
  private readonly onVisibilityChange = () => {
    if (!document.hidden) {
      this.reapplyRemote();
      this.correctDrift();
    }
  };
  private autoplayAllowed = true;

  setAutoplayAllowed(allowed: boolean): void {
    this.autoplayAllowed = allowed;
    if (!allowed) this.allowNextNavigation = false;
    if (!allowed) this.preventAutoplay();
  }

  start(): void {
    this.stopped = false;
    this.lastMediaId = currentMediaId();
    window.addEventListener("yt-navigate-finish", this.onNavigate);
    document.addEventListener("pointerdown", this.onUserInteraction, true);
    document.addEventListener("keydown", this.onUserInteraction, true);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.attach();
    if (this.videoWatchTimer) clearInterval(this.videoWatchTimer);
    this.videoWatchTimer = setInterval(() => {
      if (this.stopped) return;
      const video = youtubeVideo();
      if (video && video !== this.video) this.attach();
    }, ATTACH_RETRY_MS);
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener("yt-navigate-finish", this.onNavigate);
    document.removeEventListener("pointerdown", this.onUserInteraction, true);
    document.removeEventListener("keydown", this.onUserInteraction, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.attachRetryTimer) clearTimeout(this.attachRetryTimer);
    if (this.correctionTimer) clearInterval(this.correctionTimer);
    if (this.videoWatchTimer) clearInterval(this.videoWatchTimer);
    if (this.audioChangeTimer) clearTimeout(this.audioChangeTimer);
    if (this.frameRequest !== null) {
      const video = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null;
      video?.cancelVideoFrameCallback?.(this.frameRequest);
    }
    this.correctionTimer = null;
    this.videoWatchTimer = null;
    this.audioChangeTimer = null;
    this.frameRequest = null;
    this.detach();
    this.pendingRemoteState = null;
    this.remoteState = null;
    this.remoteAnchor = null;
    this.pendingLocalControlUntil = 0;
    this.correctionActive = false;
    this.localAudioChangeUntil = 0;
    this.applyingRemoteAudio = false;
    this.lockedMedia = null;
    this.allowNextNavigation = false;
    this.seeking = false;
    this.seekWasPlaying = null;
    this.suppressPlaybackEventsUntil = 0;
    this.remoteEventTypes.clear();
    this.remoteRateChangeTarget = null;
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
      volume: Number.isFinite(video.volume) ? Math.min(1, Math.max(0, video.volume)) : 1,
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
  applyRemote(state: RemotePlaybackState, force = false): void {
    if (force) this.localAudioChangeUntil = 0;
    this.pendingLocalControlUntil = 0;
    this.correctionActive = false;
    this.remoteEventTypes.clear();
    this.remoteRateChangeTarget = null;
    this.remoteState = state;
    this.pendingRemoteState = state;
    this.remoteAnchor = {
      position: state.paused
        ? state.position
        : state.position + Math.max(0, (state.serverNow ?? Date.now()) - state.updatedAt) / 1000 * state.playbackRate,
      at: performance.now(),
    };
    this.applyPendingRemote();
  }

  private applyPendingRemote(): void {
    const video = this.video;
    // YouTube can replace its <video> node without a new server snapshot.
    // Reapply the last authoritative state to every newly attached node.
    const state = this.pendingRemoteState ?? this.remoteState;
    if (!video || !state || Number.isNaN(video.duration)) return;
    this.pendingRemoteState = null;
    this.remoteEventUntil = Date.now() + REMOTE_EVENT_WINDOW_MS;
    this.applyAudio(state);
    this.correctDrift();
  }

  private reapplyRemote(): void {
    if (Date.now() < this.pendingLocalControlUntil) return;
    if (this.remoteState) this.pendingRemoteState = this.remoteState;
    this.applyPendingRemote();
  }

  private projectedPosition(): number | null {
    const state = this.remoteState;
    const anchor = this.remoteAnchor;
    if (!state || !anchor) return null;
    return state.paused
      ? anchor.position
      : anchor.position + (performance.now() - anchor.at) / 1000 * state.playbackRate;
  }

  private applyAudio(state: RemotePlaybackState): void {
    const video = this.video;
    if (!video) return;
    const volume = Math.min(1, Math.max(0, state.volume));
    const differs = video.volume !== volume || video.muted !== state.muted;
    if (!differs) {
      this.localAudioChangeUntil = 0;
      return;
    }
    if (Date.now() < this.localAudioChangeUntil) return;
    this.applyingRemoteAudio = true;
    try {
      if (video.volume !== volume) {
        this.markRemoteChange("audiochange");
        video.volume = volume;
      }
      if (video.muted !== state.muted) {
        this.markRemoteChange("audiochange");
        video.muted = state.muted;
      }
    } finally {
      this.applyingRemoteAudio = false;
    }
  }

  private correctDrift(): void {
    if (this.seeking || Date.now() < this.pendingLocalControlUntil) return;
    const video = this.video;
    const state = this.remoteState;
    const anchor = this.remoteAnchor;
    if (!video || !state || !anchor || Number.isNaN(video.duration)) return;

    const target = this.projectedPosition();
    if (target === null) return;
    this.applyAudio(state);

    if (state.paused) {
      this.correctionActive = false;
      if (!video.paused) {
        this.markRemoteChange("pause");
        video.pause();
      }
      if (Math.abs(video.currentTime - target) > DRIFT_CORRECTION_SECONDS) {
        this.markRemoteChange("seek");
        video.currentTime = target;
      }
      if (video.playbackRate !== state.playbackRate) {
        this.markRemoteRateChange(state.playbackRate);
        video.playbackRate = state.playbackRate;
      }
      return;
    }

    const drift = target - video.currentTime;
    const hardSeek = Math.abs(drift) > HARD_SEEK_DRIFT_SECONDS;
    if (hardSeek) {
      this.markRemoteChange("seek");
      video.currentTime = target;
      this.correctionActive = false;
    }
    if (!hardSeek && Math.abs(drift) > DRIFT_CORRECTION_SECONDS) this.correctionActive = true;
    if (this.correctionActive && Math.abs(drift) <= DRIFT_CORRECTION_STOP_SECONDS) {
      this.correctionActive = false;
    }
    const correction = Math.max(-MAX_RATE_CORRECTION, Math.min(MAX_RATE_CORRECTION, drift / 0.5));
    const desiredRate = !hardSeek && this.correctionActive
      ? Math.max(0.25, Math.min(4, state.playbackRate + correction))
      : state.playbackRate;
    if (video.playbackRate !== desiredRate) {
      this.markRemoteRateChange(desiredRate);
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

  private markRemoteRateChange(target: number): void {
    this.remoteRateChangeTarget = target;
    this.markRemoteChange("ratechange");
  }

  private attach(): void {
    if (this.stopped) return;
    this.detach();
    const video = youtubeVideo();
    if (!video) {
      this.attachRetryTimer = setTimeout(() => this.attach(), ATTACH_RETRY_MS);
      return;
    }
    this.video = video;
    this.preventAutoplay();
    const on = (name: string, fn: EventListener) => {
      video.addEventListener(name, fn);
      this.videoListeners.push([name, fn]);
    };
    on("seeking", () => {
      const remoteSeekActive = this.remoteEventTypes.has("seek") && Date.now() <= this.remoteEventUntil;
      if (!remoteSeekActive && !this.seeking)
        this.seekWasPlaying = !video.paused;
      this.seeking = true;
      this.suppressPlaybackEventsUntil = Date.now() + SEEK_EVENT_SETTLE_MS;
    });
    on("play", () => {
      if (!this.isSeeking()) this.emitControlEvent("play");
    });
    on("pause", () => {
      if (!this.isSeeking()) this.emitControlEvent("pause");
    });
    on("seeked", () => {
      const localSeek = this.seekWasPlaying !== null;
      const wasPlaying = this.seekWasPlaying ?? !video.paused;
      this.seeking = false;
      this.suppressPlaybackEventsUntil = Date.now() + SEEK_EVENT_SETTLE_MS;
      this.emitControlEvent("seek", localSeek ? !wasPlaying : undefined, localSeek);
      this.seekWasPlaying = null;
      if (localSeek && wasPlaying && this.autoplayAllowed && video.paused)
        void video.play().catch(() => undefined);
    });
    on("ratechange", () => this.emitControlEvent("ratechange"));
    on("volumechange", () => {
      if (this.applyingRemoteAudio) return;
      if (this.remoteState && this.audioMatchesRemoteState()) return;
      this.localAudioChangeUntil = Date.now() + REMOTE_EVENT_WINDOW_MS;
      this.emitAudioChange();
    });
    on("waiting", () => this.emitBuffering(true));
    on("playing", () => {
      if (this.isSeeking()) return;
      this.reapplyRemote();
      this.correctDrift();
      this.emitBuffering(false);
    });
    on("loadedmetadata", () => this.reapplyRemote());
    on("durationchange", () => this.reapplyRemote());
    on("canplay", () => this.reapplyRemote());
    on("pointerdown", () => this.reapplyRemote());
    on("ended", () => {
      if (this.autoplayAllowed) {
        this.allowNextNavigation = true;
        return;
      }
      this.preventAutoplay();
      this.reapplyRemote();
    });
    if (!video.requestVideoFrameCallback) {
      this.correctionTimer = setInterval(() => this.correctDrift(), CORRECTION_INTERVAL_MS);
    }
    this.reapplyRemote();
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
    this.seeking = false;
    this.suppressPlaybackEventsUntil = 0;
    this.correctionActive = false;
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
    const hostAutoplayNavigation = this.autoplayAllowed && this.allowNextNavigation;
    this.allowNextNavigation = false;
    if (this.lockedMedia && !this.isLockedMedia() && !hostAutoplayNavigation) {
      if (!this.autoplayAllowed) {
        this.video?.pause();
        this.preventAutoplay();
      }
      this.notify({ type: "navigationBlocked", attemptedUrl: location.href });
      this.restoreLockedMedia();
      return;
    }
    if (hostAutoplayNavigation) this.lockedMedia = { mediaId, url: location.href };
    this.attach();
    this.notifyMediaChangeWhenReady();
  }

  private notifyMediaChangeWhenReady(attempt = 0): void {
    if (this.stopped) return;
    const snapshot = this.getSnapshot();
    if (snapshot) {
      this.notify({ type: "mediaChange", snapshot });
      return;
    }
    if (attempt < 20) window.setTimeout(() => this.notifyMediaChangeWhenReady(attempt + 1), 250);
  }

  private preventAutoplay(): void {
    if (this.autoplayAllowed || !this.video) return;
    this.video.autoplay = false;
    this.video.removeAttribute("autoplay");
  }

  private isLockedMedia(): boolean {
    const locked = this.lockedMedia;
    if (!locked) return true;
    if (locked.mediaId !== null || currentMediaId() !== null)
      return (locked.mediaId ?? mediaIdFromUrl(locked.url)) === currentMediaId();
    return location.href === locked.url;
  }

  private restoreLockedMedia(): void {
    const locked = this.lockedMedia;
    if (!locked || this.isLockedMedia() || this.stopped) return;
    window.setTimeout(() => {
      if (!this.stopped && !this.isLockedMedia()) window.location.replace(locked.url);
    }, 0);
  }

  private emitControlEvent(type: ControlEventType, seekPaused?: boolean, force = false): void {
    if (!force && this.matchesRemoteState(type)) return;
    if (
      type === "ratechange" &&
      this.remoteState &&
      this.video &&
      Math.abs(this.video.playbackRate - this.remoteState.playbackRate) <= MAX_RATE_CORRECTION + RATE_CHANGE_MATCH_EPSILON
    ) return;
    const snapshot = this.getSnapshot();
    if (!snapshot) return;
    this.pendingLocalControlUntil = Date.now() + REMOTE_EVENT_WINDOW_MS;
    if (type === "seek") this.notify({ type, snapshot, paused: seekPaused ?? snapshot.paused });
    else this.notify({ type, snapshot });
  }

  private isSeeking(): boolean {
    return this.seeking || Date.now() < this.suppressPlaybackEventsUntil;
  }

  private emitAudioChange(): void {
    if (this.audioChangeTimer) clearTimeout(this.audioChangeTimer);
    this.audioChangeTimer = setTimeout(() => {
      this.audioChangeTimer = null;
      this.emitControlEvent("audiochange");
    }, AUDIO_CHANGE_DEBOUNCE_MS);
  }

  private audioMatchesRemoteState(): boolean {
    const video = this.video;
    const state = this.remoteState;
    return !!video && !!state && video.muted === state.muted && Math.abs(video.volume - state.volume) <= 0.001;
  }

  private matchesRemoteState(type: ControlEventType): boolean {
    const video = this.video;
    const state = this.remoteState;
    const target = this.projectedPosition();
    if (!video || !state || target === null || !this.remoteEventTypes.has(type) || Date.now() > this.remoteEventUntil) return false;
    const matches = type === "play" || type === "pause"
      ? video.paused === state.paused
      : type === "ratechange"
        ? Math.abs(video.playbackRate - (this.remoteRateChangeTarget ?? state.playbackRate)) <= RATE_CHANGE_MATCH_EPSILON
        : type === "audiochange"
          ? this.audioMatchesRemoteState()
          : Math.abs(video.currentTime - target) <= HARD_SEEK_DRIFT_SECONDS;
    if (matches) {
      this.remoteEventTypes.delete(type);
      if (type === "ratechange") this.remoteRateChangeTarget = null;
    }
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

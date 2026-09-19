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
}

export interface RemotePlaybackState {
  position: number;
  paused: boolean;
  playbackRate: number;
  // Server clock ms this position was authoritative at — lets a still-
  // playing state's position be projected forward instead of constantly
  // re-seeking to a slightly-stale value.
  updatedAt: number;
}

export type LocalMediaEvent =
  | { type: "play" | "pause" | "seek" | "ratechange"; snapshot: MediaSnapshot }
  | { type: "mediaChange"; snapshot: MediaSnapshot }
  | { type: "buffering"; buffering: boolean; position: number };

// How far local and server-projected position may drift before a running
// video is corrected — avoids visibly jittering the playhead for normal
// network jitter.
const DRIFT_CORRECTION_SECONDS = 1.5;
// How long to ignore native video events right after this adapter itself
// changed the video, so applying remote state doesn't get re-published as
// a local control event (see docs/extension-architecture.md section 10).
// PlaybackSyncController no longer applies self-caused state at all (see
// its updatedBy check), which was this window's main trigger — this is
// now mostly covering the case where a genuinely remote play/seek takes a
// while to actually fire its native event (e.g. buffering into an
// unfetched position on a slow connection).
const SUPPRESSION_WINDOW_MS = 1000;
const ATTACH_RETRY_MS = 500;

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
  private suppressUntil = 0;
  private attachRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMediaId: string | null = null;
  private stopped = false;
  private readonly listeners = new Set<(event: LocalMediaEvent) => void>();
  private readonly onNavigate = () => this.handleNavigation();

  start(): void {
    this.stopped = false;
    this.lastMediaId = currentMediaId();
    window.addEventListener("yt-navigate-finish", this.onNavigate);
    this.attach();
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener("yt-navigate-finish", this.onNavigate);
    if (this.attachRetryTimer) clearTimeout(this.attachRetryTimer);
    this.detach();
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
    };
  }

  // Applies authoritative server state without re-emitting it as a local
  // control event — the caller (playback-sync controller) decides when
  // this is warranted (a genuinely new state, or periodic drift check).
  applyRemote(state: RemotePlaybackState): void {
    const video = this.video;
    if (!video) return;
    this.suppressUntil = Date.now() + SUPPRESSION_WINDOW_MS;

    const projected = state.paused
      ? state.position
      : state.position + Math.max(0, Date.now() - state.updatedAt) / 1000;
    if (Math.abs(video.currentTime - projected) > DRIFT_CORRECTION_SECONDS) {
      video.currentTime = projected;
    }
    if (video.playbackRate !== state.playbackRate) video.playbackRate = state.playbackRate;
    if (state.paused && !video.paused) video.pause();
    else if (!state.paused && video.paused) void video.play().catch(() => undefined);
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
    on("waiting", () => this.emitBuffering(true));
    on("playing", () => this.emitBuffering(false));
  }

  private detach(): void {
    if (this.video) {
      for (const [name, fn] of this.videoListeners) this.video.removeEventListener(name, fn);
    }
    this.videoListeners = [];
    this.video = null;
  }

  private handleNavigation(): void {
    const mediaId = currentMediaId();
    if (mediaId === this.lastMediaId) return;
    this.lastMediaId = mediaId;
    this.attach();
    // The new page's <video> element takes a moment to report real
    // duration/currentTime — wait a beat before snapshotting it.
    setTimeout(() => {
      const snapshot = this.getSnapshot();
      if (snapshot) this.notify({ type: "mediaChange", snapshot });
    }, 300);
  }

  private emitControlEvent(type: "play" | "pause" | "seek" | "ratechange"): void {
    if (Date.now() < this.suppressUntil) return;
    const snapshot = this.getSnapshot();
    if (!snapshot) return;
    this.notify({ type, snapshot });
  }

  private emitBuffering(buffering: boolean): void {
    if (Date.now() < this.suppressUntil) return;
    const video = this.video;
    if (!video) return;
    this.notify({ type: "buffering", buffering, position: video.currentTime });
  }

  private notify(event: LocalMediaEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

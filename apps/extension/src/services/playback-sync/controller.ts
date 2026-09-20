import { YoutubeMediaAdapter, type LocalMediaEvent } from "@/media/youtube-adapter";
import { PlaybackSocket, type ServerEvent } from "@/services/playback-socket/client";

export interface SyncedPlaybackState {
  title?: string;
  paused: boolean;
  position: number;
  playbackRate: number;
  muted: boolean;
  volume: number;
  updatedAt: number;
}

export interface PlaybackSyncHandlers {
  onPlaybackState: (state: SyncedPlaybackState | null) => void;
  onConnectionChange: (connected: boolean) => void;
  onAutoplayBlocked?: (blocked: boolean) => void;
  onNavigationBlocked?: () => void;
  // room.member_joined/left/host_changed/kicked/ended/settings_changed etc.
  // — everything except the playback.state/no_state this controller
  // already applies itself. The caller (room-store) reacts to these.
  onRoomEvent: (event: ServerEvent) => void;
}

// Ties the WebSocket protocol client to the actual YouTube <video> element:
// local control events become outgoing WS events (when this client is
// allowed to control playback); incoming authoritative state gets applied
// back to the player. Everything else (room membership, moderation, room
// lifecycle) is just forwarded to the caller.
export class PlaybackSyncController {
  private readonly adapter = new YoutubeMediaAdapter();
  private readonly socket: PlaybackSocket;
  private unsubscribeAdapter: (() => void) | null = null;
  private lastAppliedSequence = -1;
  private authoritativeStateReady = false;
  private authoritativeState: SyncedPlaybackState | null = null;
  private hostSnapshotTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    roomId: string,
    getTicket: () => Promise<string>,
    private readonly selfUserId: string,
    private isHost: boolean,
    private everyoneCanControl: boolean,
    private readonly handlers: PlaybackSyncHandlers,
  ) {
    this.socket = new PlaybackSocket(roomId, getTicket, {
      onEvent: (event) => this.handleServerEvent(event),
      onOpen: () => {
        this.lastAppliedSequence = -1;
        this.authoritativeStateReady = false;
        this.authoritativeState = null;
        this.handlers.onConnectionChange(true);
      },
      onClose: () => {
        this.authoritativeStateReady = false;
        this.authoritativeState = null;
        this.handlers.onConnectionChange(false);
      },
    });
  }

  start(): void {
    this.lastAppliedSequence = -1;
    this.authoritativeStateReady = false;
    this.authoritativeState = null;
    this.adapter.start();
    this.adapter.lockToCurrentMedia();
    this.unsubscribeAdapter = this.adapter.subscribe((event) => this.handleLocalEvent(event));
    this.socket.connect();
  }

  stop(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.adapter.stop();
    this.socket.close();
    if (this.hostSnapshotTimer) clearTimeout(this.hostSnapshotTimer);
    this.hostSnapshotTimer = null;
  }

  private get canControl(): boolean {
    return this.isHost || this.everyoneCanControl;
  }

  private handleLocalEvent(event: LocalMediaEvent): void {
    if (event.type === "autoplayBlocked") {
      this.handlers.onAutoplayBlocked?.(event.blocked);
      return;
    }
    if (event.type === "navigationBlocked") {
      this.handlers.onNavigationBlocked?.();
      if (this.authoritativeState) {
        this.adapter.applyRemote({
          ...this.authoritativeState,
          serverNow: this.socket.serverNow(),
        });
      }
      return;
    }
    if (!this.authoritativeStateReady || !this.authoritativeState) return;
    if (event.type === "buffering") {
      if (this.canControl) this.socket.buffering({ buffering: event.buffering, position: event.position });
      return;
    }
    // Not authorized to control playback here — the server would reject
    // it anyway (that's the real enforcement), but there's no point
    // sending events that can only ever be rejected.
    if (!this.canControl) {
      if (this.authoritativeState) {
        this.adapter.applyRemote({
          ...this.authoritativeState,
          serverNow: this.socket.serverNow(),
        });
      }
      return;
    }

    const { snapshot } = event;
    const media = {
      provider: "YOUTUBE" as const,
      mediaId: snapshot.mediaId,
      url: snapshot.url,
      position: snapshot.position,
    };
    if (event.type === "play") this.socket.play(media);
    else if (event.type === "pause") this.socket.pause(media);
    else if (event.type === "seek") this.socket.seek(media);
    else if (event.type === "ratechange") {
      this.socket.rateChange({ position: snapshot.position, playbackRate: snapshot.playbackRate });
    } else if (event.type === "audiochange") {
      this.socket.audioChange({
        position: snapshot.position,
        muted: snapshot.muted,
        volume: snapshot.volume,
      });
    } else if (event.type === "mediaChange") {
      this.socket.mediaChange({
        ...media,
        paused: snapshot.paused,
        muted: snapshot.muted,
        volume: snapshot.volume,
        metadata: snapshot.title ? { title: snapshot.title } : undefined,
      });
    }
  }

  private publishHostSnapshot(attempt = 0): void {
    if (!this.isHost || !this.authoritativeStateReady) return;
    const snapshot = this.adapter.getSnapshot();
    if (snapshot) {
      this.socket.mediaChange({
        provider: "YOUTUBE",
        mediaId: snapshot.mediaId,
        url: snapshot.url,
        position: snapshot.position,
        paused: snapshot.paused,
        muted: snapshot.muted,
        volume: snapshot.volume,
        metadata: snapshot.title ? { title: snapshot.title } : undefined,
      });
      return;
    }
    if (attempt >= 20) return;
    this.hostSnapshotTimer = setTimeout(() => this.publishHostSnapshot(attempt + 1), 250);
  }

  private handleServerEvent(event: ServerEvent): void {
    if (event.type === "playback.state") {
      const { payload } = event;
      this.authoritativeStateReady = true;
      if (payload.stateSequence >= this.lastAppliedSequence) {
        this.lastAppliedSequence = payload.stateSequence;
        this.authoritativeState = {
          title: payload.metadata?.title,
          paused: payload.paused,
          position: payload.position,
          playbackRate: payload.playbackRate,
          muted: payload.muted,
          volume: payload.volume,
          updatedAt: payload.updatedAt,
        };
        this.adapter.lockToMedia(payload.mediaId, payload.url);
        this.adapter.applyRemote({
          position: payload.position,
          paused: payload.paused,
          playbackRate: payload.playbackRate,
          muted: payload.muted,
          volume: payload.volume,
          updatedAt: payload.updatedAt,
          serverNow: this.socket.serverNow(),
        });
      }
      this.handlers.onPlaybackState({
        title: payload.metadata?.title,
        paused: payload.paused,
        position: payload.position,
        playbackRate: payload.playbackRate,
        muted: payload.muted,
        volume: payload.volume,
        updatedAt: payload.updatedAt,
      });
      return;
    }
    if (event.type === "playback.no_state") {
      this.lastAppliedSequence = -1;
      this.authoritativeStateReady = true;
      this.authoritativeState = null;
      this.handlers.onPlaybackState(null);
      this.publishHostSnapshot();
      return;
    }
    if (event.type === "playback.control_rejected") {
      if (event.payload.code === "PLAYBACK_CONTROL_FORBIDDEN") this.socket.requestSync();
      return;
    }
    if (event.type === "room.settings_changed") {
      this.everyoneCanControl = event.payload.everyoneCanControl;
    }
    if (event.type === "room.host_changed") {
      this.isHost = event.payload.host.id === this.selfUserId;
    }
    this.handlers.onRoomEvent(event);
  }
}

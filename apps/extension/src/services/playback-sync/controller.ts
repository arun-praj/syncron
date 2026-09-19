import { YoutubeMediaAdapter, type LocalMediaEvent } from "@/media/youtube-adapter";
import { PlaybackSocket, type ServerEvent } from "@/services/playback-socket/client";

export interface SyncedPlaybackState {
  title?: string;
  paused: boolean;
  position: number;
  playbackRate: number;
  updatedAt: number;
}

export interface PlaybackSyncHandlers {
  onPlaybackState: (state: SyncedPlaybackState | null) => void;
  onConnectionChange: (connected: boolean) => void;
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
      onOpen: () => this.handlers.onConnectionChange(true),
      onClose: () => this.handlers.onConnectionChange(false),
    });
  }

  start(): void {
    this.adapter.start();
    this.unsubscribeAdapter = this.adapter.subscribe((event) => this.handleLocalEvent(event));
    this.socket.connect();
  }

  stop(): void {
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;
    this.adapter.stop();
    this.socket.close();
  }

  private get canControl(): boolean {
    return this.isHost || this.everyoneCanControl;
  }

  private handleLocalEvent(event: LocalMediaEvent): void {
    if (event.type === "buffering") {
      if (this.canControl) this.socket.buffering({ buffering: event.buffering, position: event.position });
      return;
    }
    // Not authorized to control playback here — the server would reject
    // it anyway (that's the real enforcement), but there's no point
    // sending events that can only ever be rejected.
    if (!this.canControl) return;

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
    } else if (event.type === "mediaChange") {
      this.socket.mediaChange({
        ...media,
        paused: snapshot.paused,
        metadata: snapshot.title ? { title: snapshot.title } : undefined,
      });
    }
  }

  private handleServerEvent(event: ServerEvent): void {
    if (event.type === "playback.state") {
      const { payload } = event;
      // The server broadcasts state to every socket, including the one
      // whose own action caused it (payload.updatedBy identifies the
      // author) — re-applying our own just-sent action back onto the
      // player fights in-progress local actions (e.g. an in-flight scrub)
      // with a now-stale echo, and needlessly opens the adapter's
      // suppression window. We already have the authoritative state
      // locally in that case; only apply when someone else caused it.
      if (payload.stateSequence > this.lastAppliedSequence) {
        this.lastAppliedSequence = payload.stateSequence;
        if (payload.updatedBy !== this.selfUserId) {
          this.adapter.applyRemote({
            position: payload.position,
            paused: payload.paused,
            playbackRate: payload.playbackRate,
            updatedAt: payload.updatedAt,
          });
        }
      }
      this.handlers.onPlaybackState({
        title: payload.metadata?.title,
        paused: payload.paused,
        position: payload.position,
        playbackRate: payload.playbackRate,
        updatedAt: payload.updatedAt,
      });
      return;
    }
    if (event.type === "playback.no_state") {
      this.handlers.onPlaybackState(null);
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

// Wraps livekit-client so the rest of the extension deals only in plain
// MediaStreamTrack / boolean / ChatWireMessage values — the LiveKit
// dependency stays contained to this one module, same as the WS protocol
// envelope details stay contained to services/playback-socket.
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { z } from "zod";

// LiveKit's own data-message feature isn't part of docs/API-schema.md
// (only "chat travels only through LiveKit" is specified) — this wire
// format is this client's own design, not a documented server contract.
// Deliberately carries no author identity: the server never validates
// chat, so a self-declared sender field would let any participant
// impersonate anyone else. The real sender is LiveKit's own
// cryptographically-verified participant identity (see DataReceived
// below), never something read out of the payload.
const chatWireMessageSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string().min(1).max(2000),
  sentAt: z.number().finite(),
});
export type ChatWireMessage = z.infer<typeof chatWireMessageSchema>;

const CHAT_TOPIC = "syncron.chat";

export interface LiveKitHandlers {
  // Both are null when that participant has no live, unmuted track —
  // callers should fall back to an avatar / muted icon rather than render
  // a frozen video element or attach a dead audio track. The audio track
  // must be attached to a playable element by the caller (e.g. a hidden
  // <audio autoPlay>) — being "subscribed" alone does not play sound.
  onVideoTrackChanged: (participantId: string, mediaTrack: MediaStreamTrack | null) => void;
  onAudioTrackChanged: (participantId: string, mediaTrack: MediaStreamTrack | null) => void;
  // `senderId` is LiveKit's verified participant identity (the Better
  // Auth user ID baked into their connection token server-side) — never
  // trust an "author" field inside the payload itself for this.
  onChatMessage: (senderId: string, message: ChatWireMessage) => void;
  onParticipantLeft?: (participantId: string) => void;
}

export class LiveKitSession {
  private room: Room | null = null;

  constructor(private readonly handlers: LiveKitHandlers) {}

  get localIdentity(): string | null {
    return this.room?.localParticipant.identity ?? null;
  }

  async connect(url: string, token: string): Promise<void> {
    await this.disconnect();
    const room = new Room();
    this.room = room;

    const emitVideoState = (participant: Participant) => {
      const publication = participant.getTrackPublication(Track.Source.Camera);
      const track = publication && !publication.isMuted ? (publication.track?.mediaStreamTrack ?? null) : null;
      this.handlers.onVideoTrackChanged(participant.identity, track);
    };
    const emitAudioState = (participant: Participant) => {
      const publication = participant.getTrackPublication(Track.Source.Microphone);
      const track = publication && !publication.isMuted ? (publication.track?.mediaStreamTrack ?? null) : null;
      this.handlers.onAudioTrackChanged(participant.identity, track);
    };
    const emitForKind = (kind: Track.Kind, participant: Participant) => {
      if (kind === Track.Kind.Video) emitVideoState(participant);
      else if (kind === Track.Kind.Audio) emitAudioState(participant);
    };

    room.on(RoomEvent.TrackSubscribed, (_track, publication, participant) => emitForKind(publication.kind, participant));
    room.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => emitForKind(publication.kind, participant));
    room.on(RoomEvent.TrackMuted, (publication, participant) => emitForKind(publication.kind, participant));
    room.on(RoomEvent.TrackUnmuted, (publication, participant) => emitForKind(publication.kind, participant));
    room.on(RoomEvent.LocalTrackPublished, (publication) => emitForKind(publication.kind, room.localParticipant));
    room.on(RoomEvent.LocalTrackUnpublished, (publication) => emitForKind(publication.kind, room.localParticipant));
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.handlers.onParticipantLeft?.(participant.identity);
    });
    room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (topic !== CHAT_TOPIC || !participant) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      // Untrusted input from another participant — validate its shape
      // before it goes anywhere near app state or rendering.
      const result = chatWireMessageSchema.safeParse(parsed);
      if (result.success) this.handlers.onChatMessage(participant.identity, result.data);
    });

    await room.connect(url, token);
  }

  async disconnect(): Promise<void> {
    const room = this.room;
    if (!room) return;
    this.room = null;
    await room.disconnect();
  }

  // Returns whether the device actually ended up enabled — publishing can
  // still fail even after an earlier permission check (device unplugged,
  // OS-level block, user denies the browser prompt, etc.), so callers
  // should trust this return value over any prior assumption.
  async setMicrophoneEnabled(enabled: boolean): Promise<boolean> {
    if (!this.room) return false;
    try {
      const publication = await this.room.localParticipant.setMicrophoneEnabled(enabled);
      return enabled ? publication !== undefined : true;
    } catch {
      return false;
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<boolean> {
    if (!this.room) return false;
    try {
      const publication = await this.room.localParticipant.setCameraEnabled(enabled);
      return enabled ? publication !== undefined : true;
    } catch {
      return false;
    }
  }

  sendChatMessage(message: ChatWireMessage): void {
    if (!this.room) return;
    const payload = new TextEncoder().encode(JSON.stringify(message));
    void this.room.localParticipant.publishData(payload, { reliable: true, topic: CHAT_TOPIC });
  }
}

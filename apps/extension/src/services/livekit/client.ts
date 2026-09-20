// Wraps livekit-client so the rest of the extension deals only in plain
// MediaStreamTrack / boolean values — the LiveKit
// dependency stays contained to this one module, same as the WS protocol
// envelope details stay contained to services/playback-socket.
import { Room, RoomEvent, Track, type Participant } from "livekit-client";

export interface LiveKitHandlers {
  // Both are null when that participant has no live, unmuted track —
  // callers should fall back to an avatar / muted icon rather than render
  // a frozen video element or attach a dead audio track. The audio track
  // must be attached to a playable element by the caller (e.g. a hidden
  // <audio autoPlay>) — being "subscribed" alone does not play sound.
  onVideoTrackChanged: (participantId: string, mediaTrack: MediaStreamTrack | null) => void;
  onAudioTrackChanged: (participantId: string, mediaTrack: MediaStreamTrack | null) => void;
  onActiveSpeakersChanged: (participantIds: string[]) => void;
  onParticipantLeft?: (participantId: string) => void;
}

export class LiveKitSession {
  private room: Room = new Room({
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  constructor(private readonly handlers: LiveKitHandlers) {}

  get localIdentity(): string | null {
    return this.room?.localParticipant.identity ?? null;
  }

  get currentRoom(): Room | undefined {
    return this.room;
  }

  async connect(url: string, token: string): Promise<void> {
    await this.disconnect();
    const room = this.room;
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
    const emitActiveSpeakers = (participants: Participant[]) => {
      this.handlers.onActiveSpeakersChanged(participants.map((participant) => participant.identity));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, emitActiveSpeakers);
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.handlers.onParticipantLeft?.(participant.identity);
    });
    try {
      await room.connect(url, token);
    } catch (e) {
      console.error("[Syncron] LiveKit room.connect() failed", e);
      throw e;
    }
    emitActiveSpeakers(room.activeSpeakers);
  }

  async disconnect(): Promise<void> {
    const room = this.room;
    if (!room) return;
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

}

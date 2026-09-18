import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import type { Config } from "../../../packages/config/src/index.js";
export interface MediaService {
  token(
    roomId: string,
    userId: string,
    microphoneAllowed?: boolean,
  ): Promise<{
    url: string;
    token: string;
    roomName: string;
    participantIdentity: string;
  }>;
  remove(roomId: string, userId: string): Promise<void>;
  microphone(roomId: string, userId: string, allowed: boolean): Promise<void>;
  end(roomId: string): Promise<void>;
  health(): Promise<void>;
}
export function livekit(c: Config): MediaService {
  const client = new RoomServiceClient(
    c.LIVEKIT_INTERNAL_URL.replace(/^ws/, "http"),
    c.LIVEKIT_API_KEY,
    c.LIVEKIT_API_SECRET,
    { requestTimeout: 5 },
  );
  const ignoreMissing = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      if (
        !(e && typeof e === "object" && "code" in e && e.code === "not_found")
      )
        throw e;
    }
  };
  return {
    async token(roomId, userId, microphoneAllowed = true) {
      const roomName = `sync_${roomId}`;
      const token = new AccessToken(c.LIVEKIT_API_KEY, c.LIVEKIT_API_SECRET, {
        identity: userId,
        ttl: 600,
      });
      token.addGrant({
        roomJoin: true,
        room: roomName,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: microphoneAllowed ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [TrackSource.CAMERA],
      });
      return {
        url: c.LIVEKIT_URL,
        token: await token.toJwt(),
        roomName,
        participantIdentity: userId,
      };
    },
    remove: (roomId, userId) =>
      ignoreMissing(() => client.removeParticipant(`sync_${roomId}`, userId)),
    microphone: async (roomId, userId, allowed) => {
      const room = `sync_${roomId}`;
      const participant = (await client.listParticipants(room)).find((p) => p.identity === userId);
      if (!participant) return;
      await client.updateParticipant(room, userId, undefined, {
        canPublish: true,
        canPublishData: true,
        canPublishSources: allowed ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [TrackSource.CAMERA],
      });
      if (!allowed) for (const track of participant.tracks) if (track.source === TrackSource.MICROPHONE) await client.mutePublishedTrack(room, userId, track.sid, true);
    },
    end: (roomId) => ignoreMissing(() => client.deleteRoom(`sync_${roomId}`)),
    health: async () => {
      await client.listRooms();
    },
  };
}

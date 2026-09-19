import { create } from "zustand";

import type { StreamingService } from "@/lib/streaming-services";
import { api } from "@/services/api/client";
import { LiveKitSession, type ChatWireMessage } from "@/services/livekit/client";
import { PlaybackSyncController, type SyncedPlaybackState } from "@/services/playback-sync/controller";
import type { ServerEvent } from "@/services/playback-socket/client";

export interface RoomMember {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  muted: boolean;
  synced: boolean;
  // Live camera feed from LiveKit; null means "no active unmuted camera",
  // so tiles should fall back to the avatar image.
  videoTrack: MediaStreamTrack | null;
  // Rendered by MemberGrid as a hidden <audio autoPlay> for every member
  // except self (playing your own mic back to yourself would echo).
  audioTrack: MediaStreamTrack | null;
}

export interface RoomChatMessage {
  id: string;
  kind: "system" | "chat";
  authorName?: string;
  avatarId?: string;
  time?: string;
  text: string;
}

export interface RoomReaction {
  id: string;
  label: string;
  icon: string;
}

export interface FloatingReaction {
  id: string;
  icon: string;
  left: number;
}

// A member's initial mic/sync/video UI state is always the same regardless
// of who they are — callers only need to supply identity, not the full
// RoomMember shape.
export interface RoomMemberSeed {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
}

export interface RoomIdentity {
  service: StreamingService;
  tabId: number;
  tabTitle: string;
  roomId: string;
  isHost: boolean;
  everyoneCanControl: boolean;
  // Whether *this* client is allowed to see/share an invite link — true
  // for the host always, true for a member only when the host has turned
  // on "let members share the invite".
  canShareInvite: boolean;
  inviteUrl: string | null;
  members: RoomMemberSeed[];
  // Needed to label real-time roster/chat events ("You" vs. their real
  // name) and to tell whether a room.host_changed transfer landed on us.
  selfUserId: string;
}

// Self-hosted (see public/emoji/NOTICE) instead of the design's external
// animated-PNG URLs — those fail to load inside the YouTube in-page
// sidebar, since the host page's CSP blocks the cross-origin fetch.
export const ROOM_REACTIONS: RoomReaction[] = [
  { id: "thumbs-up", label: "Thumbs up", icon: "/emoji/thumbs-up.svg" },
  { id: "joy", label: "Tears of joy", icon: "/emoji/face-with-tears-of-joy.svg" },
  { id: "heart", label: "Heart", icon: "/emoji/red-heart.svg" },
  { id: "party", label: "Party popper", icon: "/emoji/party-popper.svg" },
  { id: "scream", label: "Screaming", icon: "/emoji/face-screaming-in-fear.svg" },
  { id: "cry", label: "Crying", icon: "/emoji/loudly-crying-face.svg" },
  { id: "open-mouth", label: "Surprised", icon: "/emoji/face-with-open-mouth.svg" },
  { id: "fire", label: "Fire", icon: "/emoji/fire.svg" },
];

function inviteHintUnseen(): boolean {
  return !localStorage.getItem("syncron_invite_hint_seen");
}

function formatClockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function systemMessage(text: string): RoomChatMessage {
  return { id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: "system", text };
}

// Identifies one enterRoom() session, independent of roomId — two calls to
// enterRoom() for the SAME room (e.g. leave then immediately rejoin) still
// get distinct generations, so a slow in-flight connectRealtime() from the
// first call can never mistake itself for still being current.
let roomGenerationCounter = 0;

const MAX_CHAT_MESSAGES = 500;

interface RoomState {
  identity: RoomIdentity | null;
  copyLabel: string;
  showInviteHint: boolean;

  selfMuted: boolean;
  selfVideoOff: boolean;
  // True once enabling that device has failed (permission denied, no
  // device, etc.) — the self-mute/camera buttons re-prompt instead of just
  // toggling local UI state while this is true.
  micBlocked: boolean;
  camBlocked: boolean;

  members: RoomMember[];
  messages: RoomChatMessage[];
  draft: string;
  isPeerTyping: boolean;

  showReactionPicker: boolean;
  floatingReactions: FloatingReaction[];

  // Authoritative synced playback state from the room's WebSocket — null
  // until the first playback.state/no_state arrives.
  playbackState: SyncedPlaybackState | null;
  wsConnected: boolean;
  // Set when the server force-removed us (kicked, or the room ended) so
  // RoomScreen can navigate away and say why, instead of silently landing
  // back on the previous screen.
  forceLeaveReason: string | null;

  // Internal handles for the realtime connections this room owns — not
  // meant to be read directly by UI components.
  playbackSync: PlaybackSyncController | null;
  liveKit: LiveKitSession | null;
  activeGeneration: number;

  enterRoom: (identity: RoomIdentity) => void;
  leaveRoom: () => void;
  copyInvite: () => Promise<void>;
  dismissInviteHint: () => void;
  toggleSelfMute: () => void;
  toggleSelfVideo: () => void;
  setDraft: (draft: string) => void;
  sendMessage: () => void;
  toggleReactionPicker: () => void;
  sendReaction: (reaction: RoomReaction) => void;

  // Internal — called by enterRoom/PlaybackSyncController, not the UI.
  connectRealtime: () => Promise<void>;
  handleRoomEvent: (roomId: string, event: ServerEvent) => void;
  forceLeave: (reason: string) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  identity: null,
  copyLabel: "Copy invite link",
  showInviteHint: inviteHintUnseen(),

  selfMuted: true,
  selfVideoOff: false,
  micBlocked: false,
  camBlocked: false,

  members: [],
  messages: [],
  draft: "",
  isPeerTyping: false,

  showReactionPicker: false,
  floatingReactions: [],

  playbackState: null,
  wsConnected: false,
  forceLeaveReason: null,

  playbackSync: null,
  liveKit: null,
  activeGeneration: 0,

  enterRoom: (identity) => {
    // Tear down whatever the PREVIOUS session owned first — e.g. the user
    // used the back button (not leaveRoom) to bail out of a room and is
    // now hosting/joining a different one from the same tab. Without
    // this, the old room's WebSocket and LiveKit connection (including
    // published mic/camera tracks) would keep running invisibly forever.
    get().playbackSync?.stop();
    void get().liveKit?.disconnect();

    set({
      identity,
      members: identity.members.map((m) => ({ ...m, muted: true, synced: true, videoTrack: null, audioTrack: null })),
      messages: [],
      draft: "",
      isPeerTyping: false,
      selfMuted: true,
      selfVideoOff: false,
      micBlocked: false,
      camBlocked: false,
      showReactionPicker: false,
      floatingReactions: [],
      copyLabel: "Copy invite link",
      showInviteHint: inviteHintUnseen(),
      playbackState: null,
      wsConnected: false,
      forceLeaveReason: null,
      playbackSync: null,
      liveKit: null,
      activeGeneration: ++roomGenerationCounter,
    });
    void get().connectRealtime();
  },

  // Opens the room's WebSocket (playback sync) and LiveKit (AV + chat)
  // connections. Every callback below re-checks that this specific
  // enterRoom() call is still the active session before touching state
  // (by generation, not roomId — two enterRoom() calls for the SAME room
  // are still distinct sessions), since these all resolve asynchronously
  // and the user may have already left or moved to another room.
  connectRealtime: async () => {
    const identity = get().identity;
    if (!identity) return;
    const { roomId, selfUserId } = identity;
    const generation = get().activeGeneration;
    const stillCurrent = () => get().activeGeneration === generation;

    const playbackSync = new PlaybackSyncController(
      roomId,
      () => api.getWsTicket(roomId).then((r) => r.ticket),
      selfUserId,
      identity.isHost,
      identity.everyoneCanControl,
      {
        onPlaybackState: (state) => {
          if (stillCurrent()) set({ playbackState: state });
        },
        onConnectionChange: (connected) => {
          if (stillCurrent()) set({ wsConnected: connected });
        },
        onRoomEvent: (event) => get().handleRoomEvent(roomId, event),
      },
    );
    playbackSync.start();

    const liveKit = new LiveKitSession({
      onVideoTrackChanged: (participantId, mediaTrack) => {
        if (!stillCurrent()) return;
        set((s) => ({
          members: s.members.map((m) => (m.id === participantId ? { ...m, videoTrack: mediaTrack } : m)),
        }));
      },
      onAudioTrackChanged: (participantId, mediaTrack) => {
        if (!stillCurrent()) return;
        set((s) => ({
          members: s.members.map((m) =>
            m.id === participantId ? { ...m, audioTrack: mediaTrack, muted: !mediaTrack } : m,
          ),
        }));
      },
      onChatMessage: (senderId, message) => {
        if (!stillCurrent()) return;
        set((s) => {
          // Name/avatar come from our own server-verified roster, never
          // from the message payload — senderId itself is already
          // trustworthy (LiveKit's authenticated participant identity),
          // but a stale/departed sender falls back to a generic label
          // rather than crashing or showing nothing.
          const sender = s.members.find((m) => m.id === senderId);
          const entry: RoomChatMessage = {
            id: message.id,
            kind: "chat",
            authorName: senderId === s.identity?.selfUserId ? "You" : (sender?.name ?? "Someone"),
            avatarId: sender?.avatarId ?? "1",
            time: formatClockTime(message.sentAt),
            text: message.text,
          };
          return { messages: [...s.messages, entry].slice(-MAX_CHAT_MESSAGES) };
        });
      },
      onParticipantLeft: (participantId) => {
        if (!stillCurrent()) return;
        set((s) => ({
          members: s.members.map((m) =>
            m.id === participantId ? { ...m, videoTrack: null, audioTrack: null, muted: true } : m,
          ),
        }));
      },
    });

    set({ playbackSync, liveKit });

    try {
      const token = await api.getLivekitToken(roomId);
      if (!stillCurrent()) return;
      await liveKit.connect(token.url, token.token);
      if (!stillCurrent()) {
        void liveKit.disconnect();
        return;
      }
      const [micGranted, camGranted] = await Promise.all([
        liveKit.setMicrophoneEnabled(true),
        liveKit.setCameraEnabled(true),
      ]);
      if (!stillCurrent()) {
        // The user left (or was kicked) while the browser's permission
        // prompt / device acquisition was still pending — the enable
        // calls above may have just turned the camera/mic hardware on
        // after the fact. leaveRoom()/forceLeave() already called
        // disconnect() once, but at that point nothing had published yet;
        // call it again now that a track may actually exist to tear down.
        void liveKit.disconnect();
        return;
      }
      set({ selfMuted: !micGranted, micBlocked: !micGranted, selfVideoOff: !camGranted, camBlocked: !camGranted });
    } catch {
      // Playback sync still works without LiveKit — AV/chat just aren't
      // available this session (e.g. LiveKit unreachable/misconfigured).
    }
  },

  handleRoomEvent: (roomId, event) => {
    if (get().identity?.roomId !== roomId) return;
    switch (event.type) {
      case "room.member_joined": {
        const joined = event.payload.member;
        set((s) => {
          if (s.members.some((m) => m.id === joined.user.id)) return s;
          const member: RoomMember = {
            id: joined.user.id,
            name: joined.user.id === s.identity?.selfUserId ? "You" : joined.user.displayName,
            avatarId: joined.user.avatarId ?? "1",
            isHost: joined.role === "HOST",
            muted: true,
            synced: true,
            videoTrack: null,
            audioTrack: null,
          };
          return {
            members: [...s.members, member],
            messages: [...s.messages, systemMessage(`${joined.user.displayName} joined the party`)],
          };
        });
        return;
      }
      case "room.member_left": {
        set((s) => {
          const leaving = s.members.find((m) => m.id === event.payload.userId);
          return {
            members: s.members.filter((m) => m.id !== event.payload.userId),
            messages: leaving ? [...s.messages, systemMessage(`${leaving.name} left the party`)] : s.messages,
          };
        });
        return;
      }
      case "room.host_changed": {
        const hostId = event.payload.host.id;
        set((s) => ({
          members: s.members.map((m) => ({ ...m, isHost: m.id === hostId })),
          identity: s.identity ? { ...s.identity, isHost: s.identity.selfUserId === hostId } : s.identity,
        }));
        return;
      }
      case "room.settings_changed": {
        set((s) => ({
          identity: s.identity
            ? { ...s.identity, everyoneCanControl: event.payload.everyoneCanControl }
            : s.identity,
        }));
        return;
      }
      case "room.member_microphone_changed": {
        const { userId, microphoneAllowed } = event.payload;
        if (userId !== get().identity?.selfUserId) return;
        // The host revoked our mic permission. LiveKit's SDK will happily
        // report a later setMicrophoneEnabled(true) as "successful" (it
        // just resumes an existing publication locally, without
        // rechecking the server-side grant) — force the UI back to muted
        // ourselves so a stale "unmute" click doesn't look like it worked.
        if (!microphoneAllowed) {
          void get().liveKit?.setMicrophoneEnabled(false);
          set((s) => ({
            selfMuted: true,
            micBlocked: true,
            messages: [...s.messages, systemMessage("The host turned off your microphone")],
          }));
        }
        return;
      }
      case "playback.buffering": {
        set((s) => ({
          members: s.members.map((m) =>
            m.id === event.payload.userId ? { ...m, synced: !event.payload.buffering } : m,
          ),
        }));
        return;
      }
      case "room.kicked":
        get().forceLeave("You were removed from the party.");
        return;
      case "room.ended":
        get().forceLeave("The host ended the party.");
        return;
      default:
        return;
    }
  },

  // Server-initiated removal (kicked or the room ended) — unlike
  // leaveRoom(), the server already knows, so this never calls the
  // leave/end API itself.
  forceLeave: (reason) => {
    const { playbackSync, liveKit } = get();
    playbackSync?.stop();
    void liveKit?.disconnect();
    // Bumping the generation (not just clearing identity) invalidates any
    // in-flight connectRealtime() promise chain immediately, even before
    // it next checks stillCurrent() — see the enable-calls race note in
    // connectRealtime().
    set({
      identity: null,
      playbackSync: null,
      liveKit: null,
      forceLeaveReason: reason,
      activeGeneration: ++roomGenerationCounter,
    });
  },

  // Clears local state immediately (leaving always feels instant), then
  // best-effort tells the server — a failed request here shouldn't trap
  // the user in a room screen they've already left visually.
  leaveRoom: () => {
    const { identity, playbackSync, liveKit } = get();
    playbackSync?.stop();
    void liveKit?.disconnect();
    set({ identity: null, playbackSync: null, liveKit: null, activeGeneration: ++roomGenerationCounter });
    if (!identity) return;
    void (identity.isHost ? api.endRoom(identity.roomId) : api.leaveRoom(identity.roomId)).catch(
      () => undefined,
    );
  },

  copyInvite: async () => {
    const { identity } = get();
    if (!identity?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(identity.inviteUrl);
    } catch {
      // Link stays visible in the hint card / header for manual copying if
      // clipboard access is denied.
    }
    set({ copyLabel: "Copied!" });
    setTimeout(() => set({ copyLabel: "Copy invite link" }), 1500);
  },

  dismissInviteHint: () => {
    localStorage.setItem("syncron_invite_hint_seen", "1");
    set({ showInviteHint: false });
  },

  toggleSelfMute: () => {
    const { liveKit, selfMuted } = get();
    if (!liveKit) return;
    const wantEnabled = selfMuted;
    void liveKit.setMicrophoneEnabled(wantEnabled).then((ok) => {
      set({ selfMuted: wantEnabled ? !ok : true, micBlocked: wantEnabled ? !ok : get().micBlocked });
    });
  },

  toggleSelfVideo: () => {
    const { liveKit, selfVideoOff } = get();
    if (!liveKit) return;
    const wantEnabled = selfVideoOff;
    void liveKit.setCameraEnabled(wantEnabled).then((ok) => {
      set({ selfVideoOff: wantEnabled ? !ok : true, camBlocked: wantEnabled ? !ok : get().camBlocked });
    });
  },

  setDraft: (draft) => set({ draft }),

  sendMessage: () => {
    const { draft, identity, liveKit } = get();
    const text = draft.trim();
    if (!text || !identity) return;
    const selfMember = get().members.find((m) => m.id === identity.selfUserId);
    const wireMessage: ChatWireMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      sentAt: Date.now(),
    };
    const entry: RoomChatMessage = {
      id: wireMessage.id,
      kind: "chat",
      authorName: "You",
      avatarId: selfMember?.avatarId ?? "1",
      time: formatClockTime(wireMessage.sentAt),
      text,
    };
    set((s) => ({
      messages: [...s.messages, entry].slice(-MAX_CHAT_MESSAGES),
      draft: "",
    }));
    liveKit?.sendChatMessage(wireMessage);
  },

  toggleReactionPicker: () => set((s) => ({ showReactionPicker: !s.showReactionPicker })),

  sendReaction: (reaction) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({
      floatingReactions: [...s.floatingReactions, { id, icon: reaction.icon, left: 15 + Math.random() * 60 }],
      showReactionPicker: false,
    }));
    setTimeout(() => {
      set((s) => ({ floatingReactions: s.floatingReactions.filter((r) => r.id !== id) }));
    }, 1800);
  },
}));

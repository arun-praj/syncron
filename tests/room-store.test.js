import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const api = {
    getRoom: vi.fn(),
    getRoomMembers: vi.fn(),
    getInvite: vi.fn(),
    getWsTicket: vi.fn(),
    getLivekitToken: vi.fn(),
    leaveRoom: vi.fn(),
  };
  const playbackInstances = [];
  const playbackHandlers = [];
  const PlaybackSyncController = vi.fn().mockImplementation((...args) => {
    playbackHandlers.push(args[5]);
    const instance = { start: vi.fn(), stop: vi.fn() };
    playbackInstances.push(instance);
    return instance;
  });
  const liveKitInstances = [];
  const LiveKitSession = vi.fn().mockImplementation(() => {
    const instance = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      setMicrophoneEnabled: vi.fn().mockResolvedValue(true),
      setCameraEnabled: vi.fn().mockResolvedValue(true),
    };
    liveKitInstances.push(instance);
    return instance;
  });
  return { api, PlaybackSyncController, playbackInstances, playbackHandlers, LiveKitSession, liveKitInstances };
});

vi.mock("@/services/api/client", () => ({
  api: mocks.api,
  ApiError: class ApiError extends Error {
    constructor(_code, status, message) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock("@/services/playback-sync/controller", () => ({ PlaybackSyncController: mocks.PlaybackSyncController }));
vi.mock("@/services/livekit/client", () => ({ LiveKitSession: mocks.LiveKitSession }));
vi.mock("@/lib/room-session", () => ({
  setActiveYoutubeRoom: vi.fn().mockResolvedValue(undefined),
  clearActiveYoutubeRoom: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/room/member-label", () => ({ formatMemberLabel: vi.fn(() => "member") }));
vi.mock("@/lib/format-time", () => ({ formatPlaybackTime: vi.fn(() => "0:00") }));

vi.stubGlobal("localStorage", {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

const room = { everyoneCanControl: false, allowMembersToShareInvite: true };
const members = [{
  user: { id: "user-1", displayName: "One", username: "one", avatarId: "1" },
  role: "HOST",
}];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

const identity = (tabTitle) => ({
  service: { id: "YOUTUBE", name: "YouTube", origin: "https://www.youtube.com" },
  tabId: 1,
  tabTitle,
  roomId: "room-1",
  isHost: true,
  everyoneCanControl: false,
  canShareInvite: true,
  inviteUrl: `https://localhost:8000/invite/${tabTitle}`,
  members: [{ id: "user-1", name: "You", avatarId: "1", isHost: true }],
  selfUserId: "user-1",
});

const roomStore = await import("../apps/extension/src/stores/room-store.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.playbackInstances.length = 0;
  mocks.playbackHandlers.length = 0;
  mocks.liveKitInstances.length = 0;
  mocks.api.getRoom.mockResolvedValue({ room });
  mocks.api.getRoomMembers.mockResolvedValue({ members });
  mocks.api.getInvite.mockResolvedValue({ inviteUrl: "https://localhost:8000/invite/current" });
  mocks.api.getWsTicket.mockResolvedValue({ ticket: "ticket" });
  mocks.api.getLivekitToken.mockResolvedValue({ url: "wss://livekit.test", token: "token" });
  mocks.api.leaveRoom.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  roomStore.useRoomStore.setState({
    identity: null,
    copyLabel: "Copy invite link",
    playbackSync: null,
    liveKit: null,
    liveKitReady: false,
    forceLeaveReason: null,
    activeGeneration: 0,
  });
});

describe("invite copying", () => {
  test("shows success only after the clipboard write succeeds", async () => {
    roomStore.useRoomStore.setState({ identity: identity("current"), activeGeneration: 100 });

    await roomStore.useRoomStore.getState().copyInvite();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(identity("current").inviteUrl);
    expect(roomStore.useRoomStore.getState().copyLabel).toBe("Copied!");
  });

  test("keeps the manual-copy label when the clipboard write is rejected", async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
    roomStore.useRoomStore.setState({ identity: identity("current"), activeGeneration: 100 });

    await roomStore.useRoomStore.getState().copyInvite();

    expect(roomStore.useRoomStore.getState().copyLabel).toBe("Copy invite link");
  });
});

describe("room connection generations", () => {
  test("stale roster success cannot construct connections after a same-room replacement", async () => {
    const oldInvite = deferred();
    mocks.api.getInvite.mockReturnValueOnce(oldInvite.promise);

    roomStore.useRoomStore.getState().enterRoom(identity("old"));
    await flush();
    roomStore.useRoomStore.getState().enterRoom(identity("new"));
    await flush();
    oldInvite.resolve({ inviteUrl: "https://localhost:8000/invite/old" });
    await flush();

    expect(roomStore.useRoomStore.getState().identity?.tabTitle).toBe("new");
    expect(roomStore.useRoomStore.getState().identity?.inviteUrl).toBe("https://localhost:8000/invite/current");
    expect(mocks.PlaybackSyncController).toHaveBeenCalledTimes(1);
  });

  test("stale roster failure cannot force-leave a replacement room", async () => {
    const oldRoom = deferred();
    mocks.api.getRoom.mockReturnValueOnce(oldRoom.promise);

    roomStore.useRoomStore.getState().enterRoom(identity("old"));
    await flush();
    roomStore.useRoomStore.getState().enterRoom(identity("new"));
    await flush();
    oldRoom.reject(new Error("temporary failure"));
    await flush();

    expect(roomStore.useRoomStore.getState().identity?.tabTitle).toBe("new");
    expect(roomStore.useRoomStore.getState().forceLeaveReason).toBeNull();
    expect(mocks.PlaybackSyncController).toHaveBeenCalledTimes(1);
  });

  test("same-room replacement survives an old disband response", async () => {
    const oldLeave = deferred();
    mocks.api.leaveRoom.mockReturnValueOnce(oldLeave.promise);
    roomStore.useRoomStore.setState({ identity: identity("old"), activeGeneration: 100 });

    const leaving = roomStore.useRoomStore.getState().leaveRoom({ disband: true });
    roomStore.useRoomStore.getState().enterRoom(identity("new"));
    oldLeave.resolve();

    await expect(leaving).resolves.toBe(false);
    expect(roomStore.useRoomStore.getState().identity?.tabTitle).toBe("new");
  });

  test("a current successful leave clears the room and resolves true", async () => {
    roomStore.useRoomStore.setState({ identity: identity("current"), activeGeneration: 100 });

    await expect(roomStore.useRoomStore.getState().leaveRoom()).resolves.toBe(true);
    expect(roomStore.useRoomStore.getState().identity).toBeNull();
  });

  test("a terminal playback error exits the current room", async () => {
    roomStore.useRoomStore.getState().enterRoom(identity("current"));
    await flush();

    mocks.playbackHandlers[0].onTerminal("You are no longer a member of this party.");
    await flush();

    expect(mocks.playbackInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(roomStore.useRoomStore.getState().identity).toBeNull();
    expect(roomStore.useRoomStore.getState().forceLeaveReason).toBe("You are no longer a member of this party.");
  });

  test("labels pause and volume playback status separately", async () => {
    roomStore.useRoomStore.getState().enterRoom(identity("current"));
    await flush();

    const handlers = mocks.playbackHandlers[0];
    handlers.onPlaybackTransition(true, "user-1");
    handlers.onPlaybackAudioChange(false, 0.9, "user-1");

    const messages = roomStore.useRoomStore.getState().messages.map((message) => message.text);
    expect(messages).toContain("member paused the video");
    expect(messages).toContain("member set the volume to 90");
  });

  test("a terminal error from a replaced controller cannot clear the new room", async () => {
    roomStore.useRoomStore.getState().enterRoom(identity("old"));
    await flush();
    const oldTerminal = mocks.playbackHandlers[0].onTerminal;
    roomStore.useRoomStore.getState().enterRoom(identity("new"));
    await flush();

    oldTerminal("The host ended the party.");
    await flush();

    expect(roomStore.useRoomStore.getState().identity?.tabTitle).toBe("new");
    expect(roomStore.useRoomStore.getState().forceLeaveReason).toBeNull();
  });
});

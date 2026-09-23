import { beforeEach, describe, expect, test, vi } from "vitest";
import { withInitialDevicePreferences } from "@/lib/extension-messages";

const mocks = vi.hoisted(() => {
  const values = new Map();
  let activeRoom = null;
  let messageListener;
  const browser = {
    runtime: {
      id: "extension-id",
      getManifest: vi.fn(() => ({ permissions: ["storage"] })),
      onMessage: { addListener: vi.fn((listener) => { messageListener = listener; }) },
      onMessageExternal: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
    },
    tabs: {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue({ id: 7 }),
      query: vi.fn().mockResolvedValue([{ id: 7 }]),
      reload: vi.fn(),
      sendMessage: vi.fn(),
      onRemoved: { addListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn() },
    storage: {
      local: {
        get: vi.fn((key) => Promise.resolve({ [key]: values.get(key) })),
        set: vi.fn((entries) => {
          Object.entries(entries).forEach(([key, value]) => values.set(key, value));
          return Promise.resolve();
        }),
        remove: vi.fn((key) => {
          values.delete(key);
          return Promise.resolve();
        }),
      },
      session: {
        get: vi.fn((key) => Promise.resolve({ [key]: values.get(key) })),
        set: vi.fn((entries) => {
          Object.entries(entries).forEach(([key, value]) => values.set(key, value));
          return Promise.resolve();
        }),
        remove: vi.fn((key) => {
          values.delete(key);
          return Promise.resolve();
        }),
      },
    },
  };
  const api = {
    getRoom: vi.fn(),
    getRoomMembers: vi.fn(),
    getInvite: vi.fn(),
    me: vi.fn(),
  };
  return {
    values,
    browser,
    api,
    get messageListener() { return messageListener; },
    getActiveYoutubeRoom: vi.fn(() => Promise.resolve(activeRoom)),
    setActiveYoutubeRoom: vi.fn((_tabId, room) => {
      activeRoom = room;
      return Promise.resolve();
    }),
    clearActiveYoutubeRoom: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/lib/room-session", () => ({
  getActiveYoutubeRoom: mocks.getActiveYoutubeRoom,
  setActiveYoutubeRoom: mocks.setActiveYoutubeRoom,
  clearActiveYoutubeRoom: mocks.clearActiveYoutubeRoom,
  closedYoutubeRoomTabIds: vi.fn(() => []),
  listActiveYoutubeRooms: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/services/api/client", () => ({
  api: mocks.api,
  fetchApiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    code = "UNKNOWN_ERROR";
    status = 500;
  },
}));

vi.stubGlobal("browser", mocks.browser);
vi.stubGlobal("defineBackground", (callback) => {
  callback();
  return callback;
});

await import("../apps/extension/src/entrypoints/background.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.values.clear();
  mocks.api.getRoom.mockResolvedValue({
    room: {
      id: "room-1",
      status: "ACTIVE",
      everyoneCanControl: true,
      allowMembersToShareInvite: false,
    },
  });
  mocks.api.getRoomMembers.mockResolvedValue({
    members: [{
      user: { id: "user-1", displayName: "You", username: "you", avatarId: "1" },
      role: "MEMBER",
    }],
  });
  mocks.api.me.mockResolvedValue({ user: { id: "user-1" } });
  mocks.api.getInvite.mockResolvedValue({ inviteUrl: "https://localhost:8000/join#invite=token" });
});

describe("background invite readiness handshake", () => {
  test("lets injected YouTube content activate through the readiness handshake", async () => {
    mocks.browser.tabs.sendMessage.mockRejectedValueOnce(new Error("content script unavailable"));

    await mocks.messageListener?.({ type: "syncron:open-youtube-sidebar", tabId: 7 });

    expect(mocks.browser.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ["content-scripts/youtube.js"],
    });
    expect(mocks.browser.tabs.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocks.browser.tabs.reload).not.toHaveBeenCalled();

    await expect(
      mocks.messageListener?.({ type: "syncron:youtube-content-ready" }, { tab: { id: 7 } }),
    ).resolves.toMatchObject({ type: "syncron:activate-youtube-sidebar", tabId: 7 });
  });

  test("only adds initial device preferences when provided", () => {
    const snapshot = {
      roomId: "room-1",
      isHost: false,
      everyoneCanControl: true,
      allowMembersToShareInvite: false,
      inviteUrl: null,
      members: [],
      selfUserId: "user-1",
    };

    expect(withInitialDevicePreferences(snapshot)).toBe(snapshot);
    expect(withInitialDevicePreferences(snapshot, {
      initialMicrophoneEnabled: true,
      initialCameraEnabled: false,
    })).toMatchObject({ initialMicrophoneEnabled: true, initialCameraEnabled: false });
  });

  test("applies pending device choices once, then keeps recovery defaults off", async () => {
    await mocks.browser.storage.session.set({ syncronTargetYoutubeTabs: [7] });
    await mocks.browser.storage.session.set({ syncronPendingJoinedRooms: {
      7: {
        roomId: "room-1",
        isHost: false,
        everyoneCanControl: true,
        allowMembersToShareInvite: false,
        inviteUrl: null,
        members: [{ id: "user-1", name: "You", avatarId: "1", isHost: false }],
        selfUserId: "user-1",
        initialMicrophoneEnabled: true,
        initialCameraEnabled: true,
      },
    } });

    const listener = mocks.messageListener;
    expect(listener).toBeTypeOf("function");
    mocks.api.getRoom.mockRejectedValueOnce(new Error("temporary outage"));
    const retrying = await listener?.({ type: "syncron:youtube-content-ready" }, { tab: { id: 7 } });
    expect(retrying).toMatchObject({ roomRecovery: { status: "reconnecting" } });

    const first = await listener?.({ type: "syncron:youtube-content-ready" }, { tab: { id: 7 } });
    expect(first).toMatchObject({
      joinedRoom: { initialMicrophoneEnabled: true, initialCameraEnabled: true },
    });

    const second = await listener?.({ type: "syncron:youtube-content-ready" }, { tab: { id: 7 } });
    expect(second).toMatchObject({ joinedRoom: {} });
    expect(second?.joinedRoom).not.toHaveProperty("initialMicrophoneEnabled", true);
    expect(second?.joinedRoom).not.toHaveProperty("initialCameraEnabled", true);
  });
});

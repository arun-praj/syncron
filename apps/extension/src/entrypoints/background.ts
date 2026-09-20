import { storage } from "wxt/utils/storage";

import { isRateLimited } from "@/auth-flow";
import {
  ACTIVATE_YOUTUBE_SIDEBAR,
  isOpenYoutubeSidebarMessage,
  isOpenServiceTabMessage,
  isSyncronJoinInviteMessage,
  isSyncronPreviewInviteMessage,
  isSyncronPingMessage,
  isYoutubeContentReadyMessage,
  type JoinedRoomSnapshot,
} from "@/lib/extension-messages";
import {
  clearActiveYoutubeRoom,
  closedYoutubeRoomTabIds,
  getActiveYoutubeRoom,
  listActiveYoutubeRooms,
  setActiveYoutubeRoom,
} from "@/lib/room-session";
import { api, ApiError } from "@/services/api/client";

const TARGET_TABS_KEY = "session:syncronTargetYoutubeTabs" as const;
const PENDING_JOINS_KEY = "session:syncronPendingJoinedRooms" as const;

async function targetTabs(): Promise<number[]> {
  return (await storage.getItem<number[]>(TARGET_TABS_KEY)) ?? [];
}

async function setTargetTab(tabId: number): Promise<void> {
  const tabs = await targetTabs();
  if (!tabs.includes(tabId)) await storage.setItem(TARGET_TABS_KEY, [...tabs, tabId]);
}

async function clearTargetTab(tabId: number): Promise<void> {
  const tabs = await targetTabs();
  await storage.setItem(
    TARGET_TABS_KEY,
    tabs.filter((candidate) => candidate !== tabId),
  );
}

async function isTargetTab(tabId: number): Promise<boolean> {
  return (await targetTabs()).includes(tabId);
}

async function pendingJoins(): Promise<Record<number, JoinedRoomSnapshot>> {
  return (await storage.getItem<Record<number, JoinedRoomSnapshot>>(PENDING_JOINS_KEY)) ?? {};
}

async function pendingJoinTabIds(): Promise<number[]> {
  return Object.keys(await pendingJoins())
    .map(Number)
    .filter((tabId) => Number.isInteger(tabId));
}

async function setPendingJoin(tabId: number, snapshot: JoinedRoomSnapshot): Promise<void> {
  await storage.setItem(PENDING_JOINS_KEY, { ...(await pendingJoins()), [tabId]: snapshot });
}

async function getPendingJoin(tabId: number): Promise<JoinedRoomSnapshot | undefined> {
  return (await pendingJoins())[tabId];
}

async function clearPendingJoin(tabId: number): Promise<void> {
  const pending = await pendingJoins();
  const rest = Object.fromEntries(Object.entries(pending).filter(([id]) => Number(id) !== tabId));
  await storage.setItem(PENDING_JOINS_KEY, rest);
}

// Consumes (removes) the pending join so it's only ever applied once, even
// if a tab somehow announces readiness more than once.
async function takePendingJoin(tabId: number): Promise<JoinedRoomSnapshot | undefined> {
  const pending = await pendingJoins();
  const snapshot = pending[tabId];
  if (snapshot === undefined) return undefined;
  const rest = Object.fromEntries(Object.entries(pending).filter(([id]) => Number(id) !== tabId));
  await storage.setItem(PENDING_JOINS_KEY, rest);
  return snapshot;
}

type ActiveRoomRefresh =
  | { status: "active"; snapshot: JoinedRoomSnapshot }
  | { status: "reconnecting" }
  | { status: "inactive" };

async function refreshActiveRoom(record: { roomId: string; selfUserId: string }): Promise<ActiveRoomRefresh> {
  try {
    const [{ room }, { members }, meResponse] = await Promise.all([
      api.getRoom(record.roomId),
      api.getRoomMembers(record.roomId),
      api.me(),
    ]);
    if (room.status !== "ACTIVE") return { status: "inactive" };

    // The durable tab record is only a recovery hint. The authenticated
    // account is authoritative; using the stored ID here can incorrectly
    // restore a former user's host badge after an account switch.
    const selfUserId = meResponse.user.id;
    const self = members.find((member) => member.user.id === selfUserId);
    if (!self) return { status: "inactive" };
    const canShareInvite = self.role === "HOST" || room.allowMembersToShareInvite;
    const inviteUrl = canShareInvite
      ? await api.getInvite(record.roomId).then((result) => result.inviteUrl).catch(() => null)
      : null;

    return {
      status: "active",
      snapshot: {
        roomId: room.id,
        isHost: self.role === "HOST",
        everyoneCanControl: room.everyoneCanControl,
        allowMembersToShareInvite: room.allowMembersToShareInvite,
        inviteUrl,
        members: members.map((member) => ({
          id: member.user.id,
          name: member.user.id === selfUserId ? "You" : member.user.displayName,
          username: member.user.username,
          avatarId: member.user.avatarId ?? "1",
          isHost: member.role === "HOST",
        })),
        selfUserId,
      },
    };
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404 || error.code === "ROOM_ENDED")
    ) {
      return { status: "inactive" };
    }
    return { status: "reconnecting" };
  }
}

async function activateYoutubeTab(tabId: number): Promise<void> {
  await setTargetTab(tabId);
  try {
    await browser.tabs.sendMessage(tabId, { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId });
    return;
  } catch {
    // Tabs that were already open when the extension loaded have no content
    // script yet. Inject the same bundled entrypoint so the activation
    // handshake can run without forcing a YouTube reload.
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["content-scripts/youtube.js"],
      });
      // executeScript resolves when the file is injected, not when the
      // content script has installed its message listener.
      await browser.tabs.sendMessage(tabId, { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId });
    } catch {
      // If the loaded extension predates the scripting permission, reload is
      // the only reliable way to install the declared YouTube content script.
      await browser.tabs.reload(tabId);
    }
  }
}

function joinErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Couldn't join the party. Please try again.";
  if (isRateLimited(error.status, error.code)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (error.status === 401) return "Sign in to Syncron first, then reopen this invite link.";
  switch (error.code) {
    case "INVITE_INVALID":
      return "This invite link is no longer valid.";
    case "ROOM_ENDED":
      return "This party has already ended.";
    case "ROOM_FULL":
      return "This party is full.";
    case "ONBOARDING_REQUIRED":
      return "Finish setting up your Syncron profile, then reopen this invite link.";
    default:
      return "Couldn't join the party. Please try again.";
  }
}

async function handlePreviewInvite(invite: string) {
  try {
    const { preview } = await api.previewInvite(invite);
    return { ok: true as const, preview };
  } catch (error) {
    return { ok: false as const, message: joinErrorMessage(error) };
  }
}

async function leaveRoomBestEffort(roomId: string): Promise<void> {
  await api.leaveRoom(roomId).catch(() => undefined);
}

async function handleClosedTab(tabId: number): Promise<void> {
  const [active, pending] = await Promise.all([getActiveYoutubeRoom(tabId), getPendingJoin(tabId)]);
  const roomIds = [...new Set([active?.roomId, pending?.roomId].filter((id): id is string => !!id))];
  await Promise.all(roomIds.map(leaveRoomBestEffort));
  await Promise.all([clearTargetTab(tabId), clearActiveYoutubeRoom(tabId), clearPendingJoin(tabId)]);
}

async function leaveClosedRoomRecords(): Promise<void> {
  const openTabs = new Set(
    (await browser.tabs.query({})).flatMap((tab) => (tab.id === undefined ? [] : [tab.id])),
  );
  const [records, pendingTabIds] = await Promise.all([listActiveYoutubeRooms(), pendingJoinTabIds()]);
  const staleTabIds = new Set(
    closedYoutubeRoomTabIds(
      [...new Set([...records.map(({ tabId }) => tabId), ...pendingTabIds])],
      [...openTabs],
    ),
  );
  await Promise.all([...staleTabIds].map((tabId) => handleClosedTab(tabId)));
}

// The invite page owns navigation. This worker only performs the authoritative
// join and stores the snapshot before returning the validated destination.
async function handleJoinInvite(
  invite: string,
  tabId: number | undefined,
  preferences: { microphoneEnabled: boolean; cameraEnabled: boolean },
): Promise<{ ok: true; destination: string } | { ok: false; message: string }> {
  if (tabId === undefined) return { ok: false, message: "Open the invite in a browser tab to join." };
  try {
    const { room, membership } = await api.joinRoom(invite);
    if (!room.media) {
      await api.leaveRoom(room.id).catch(() => undefined);
      return { ok: false, message: "This party doesn't have anything playing yet." };
    }
    if (room.media.provider !== "YOUTUBE") {
      await api.leaveRoom(room.id).catch(() => undefined);
      return { ok: false, message: "Syncron only supports YouTube parties right now." };
    }

    const isHost = membership.role === "HOST";
    const [me, membersResult] = await Promise.all([api.me(), api.getRoomMembers(room.id)]);
    const inviteUrl =
      isHost || room.allowMembersToShareInvite
        ? await api
            .getInvite(room.id)
            .then((r) => r.inviteUrl)
            .catch(() => null)
        : null;

    const snapshot: JoinedRoomSnapshot = {
      roomId: room.id,
      isHost,
      everyoneCanControl: room.everyoneCanControl,
      allowMembersToShareInvite: room.allowMembersToShareInvite,
      inviteUrl,
      members: membersResult.members.map((m) => ({
        id: m.user.id,
        name: m.user.id === me.user.id ? "You" : m.user.displayName,
        username: m.user.username,
        avatarId: m.user.avatarId ?? "1",
        isHost: m.role === "HOST",
      })),
      selfUserId: me.user.id,
      initialMicrophoneEnabled: preferences.microphoneEnabled,
      initialCameraEnabled: preferences.cameraEnabled,
    };

    await setTargetTab(tabId);
    await setPendingJoin(tabId, snapshot);
    try {
      await browser.tabs.get(tabId);
    } catch {
      await handleClosedTab(tabId);
      return { ok: false, message: "The invite tab was closed before joining." };
    }
    return { ok: true, destination: room.media.url };
  } catch (e) {
    return { ok: false, message: joinErrorMessage(e) };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (isOpenServiceTabMessage(message)) {
      return browser.tabs.create({ url: message.href, active: true }).then(async (tab) => {
        if (tab.id !== undefined && message.serviceId === "YOUTUBE") {
          await activateYoutubeTab(tab.id);
        }
      });
    }

    if (isOpenYoutubeSidebarMessage(message)) {
      return activateYoutubeTab(message.tabId);
    }

    if (isYoutubeContentReadyMessage(message) && sender.tab?.id !== undefined) {
      const tabId = sender.tab.id;
      return isTargetTab(tabId).then(async (target) => {
        const pendingJoin = await takePendingJoin(tabId);
        if (pendingJoin) {
          await setActiveYoutubeRoom(tabId, {
            roomId: pendingJoin.roomId,
            selfUserId: pendingJoin.selfUserId,
          });
        }
        const storedRoom = pendingJoin
          ? { roomId: pendingJoin.roomId, selfUserId: pendingJoin.selfUserId }
          : await getActiveYoutubeRoom(tabId);
        // The target list is a navigation hint and may be lost when the
        // service worker restarts. A stored active room is authoritative.
        if (!target && !storedRoom) return undefined;
        if (!storedRoom) return { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId };

        const recovery = await refreshActiveRoom(storedRoom);
        if (recovery.status === "active") {
          await setActiveYoutubeRoom(tabId, {
            roomId: recovery.snapshot.roomId,
            selfUserId: recovery.snapshot.selfUserId,
          });
          return { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId, joinedRoom: recovery.snapshot };
        }
        if (recovery.status === "reconnecting") {
          return {
            type: ACTIVATE_YOUTUBE_SIDEBAR,
            tabId,
            roomRecovery: { status: "reconnecting" as const },
          };
        }

        await clearActiveYoutubeRoom(tabId);
        return { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId };
      });
    }
  });

  // Handles messages from the GET /join web page (see apps/api/src/app.ts)
  // via `chrome.runtime.sendMessage(EXTENSION_ID, ...)`. Only origins
  // listed in this extension's `externally_connectable.matches` (the
  // configured APP_URL) can reach this listener at all, but the payload
  // itself is still untrusted input from a web page.
  browser.runtime.onMessageExternal.addListener((message, sender) => {
    if (isSyncronPingMessage(message)) return Promise.resolve({ ok: true });
    if (isSyncronPreviewInviteMessage(message)) return handlePreviewInvite(message.invite);
    if (isSyncronJoinInviteMessage(message)) {
      return handleJoinInvite(message.invite, sender.tab?.id, {
        microphoneEnabled: message.microphoneEnabled,
        cameraEnabled: message.cameraEnabled,
      });
    }
    return undefined;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void handleClosedTab(tabId);
  });

  browser.runtime.onStartup.addListener(() => {
    void leaveClosedRoomRecords().catch(() => undefined);
  });

  browser.runtime.onInstalled.addListener(() => {
    console.log("[Syncron] background service worker ready");
  });
});

import { storage } from "wxt/utils/storage";

import { isRateLimited } from "@/auth-flow";
import {
  ACTIVATE_YOUTUBE_SIDEBAR,
  isOpenYoutubeSidebarMessage,
  isOpenServiceTabMessage,
  isSyncronJoinInviteMessage,
  isSyncronPingMessage,
  isYoutubeContentReadyMessage,
  type JoinedRoomSnapshot,
} from "@/lib/extension-messages";
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

async function setPendingJoin(tabId: number, snapshot: JoinedRoomSnapshot): Promise<void> {
  await storage.setItem(PENDING_JOINS_KEY, { ...(await pendingJoins()), [tabId]: snapshot });
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

async function activateYoutubeTab(tabId: number): Promise<void> {
  await setTargetTab(tabId);
  await browser.tabs
    .sendMessage(tabId, { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId })
    .catch(() => undefined);
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

// Orchestrates the whole join: calls the real join API, resolves who's in
// the room and whether this client may see an invite link, opens the
// party's video in a new tab, and stashes a ready-to-render snapshot for
// that tab's content script to pick up via the existing
// YOUTUBE_CONTENT_READY handshake (see below) — the same handoff already
// used for the host's "open service tab" flow.
async function handleJoinInvite(invite: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { room, membership } = await api.joinRoom(invite);
    if (!room.media) {
      return { ok: false, message: "This party doesn't have anything playing yet." };
    }
    if (room.media.provider !== "YOUTUBE") {
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
        avatarId: m.user.avatarId ?? "1",
        isHost: m.role === "HOST",
      })),
      selfUserId: me.user.id,
    };

    const tab = await browser.tabs.create({ url: room.media.url, active: true });
    if (tab.id === undefined) return { ok: false, message: "Couldn't open the party's video tab." };
    await setTargetTab(tab.id);
    await setPendingJoin(tab.id, snapshot);
    return { ok: true };
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
        if (!target) return undefined;
        const joinedRoom = await takePendingJoin(tabId);
        return { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId, joinedRoom };
      });
    }
  });

  // Handles messages from the GET /join web page (see apps/api/src/app.ts)
  // via `chrome.runtime.sendMessage(EXTENSION_ID, ...)`. Only origins
  // listed in this extension's `externally_connectable.matches` (the
  // configured APP_URL) can reach this listener at all, but the payload
  // itself is still untrusted input from a web page.
  browser.runtime.onMessageExternal.addListener((message) => {
    if (isSyncronPingMessage(message)) return Promise.resolve({ ok: true });
    if (isSyncronJoinInviteMessage(message)) return handleJoinInvite(message.invite);
    return undefined;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void clearTargetTab(tabId);
  });

  browser.runtime.onInstalled.addListener(() => {
    console.log("[Syncron] background service worker ready");
  });
});

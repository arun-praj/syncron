import { storage } from "wxt/utils/storage";

export interface ActiveYoutubeRoomRecord {
  roomId: string;
  selfUserId: string;
}

const ACTIVE_ROOM_KEY_PREFIX = "syncronActiveYoutubeRoom:";

function activeRoomKey(tabId: number): `local:${string}` {
  return `local:${ACTIVE_ROOM_KEY_PREFIX}${tabId}`;
}

export function getActiveYoutubeRoom(tabId: number): Promise<ActiveYoutubeRoomRecord | null> {
  return storage.getItem<unknown>(activeRoomKey(tabId)).then((value) => {
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { roomId?: unknown }).roomId === "string" &&
      typeof (value as { selfUserId?: unknown }).selfUserId === "string"
    ) {
      return value as ActiveYoutubeRoomRecord;
    }
    return null;
  });
}

export function setActiveYoutubeRoom(tabId: number, record: ActiveYoutubeRoomRecord): Promise<void> {
  return storage.setItem(activeRoomKey(tabId), record);
}

export function clearActiveYoutubeRoom(tabId: number): Promise<void> {
  return storage.removeItem(activeRoomKey(tabId));
}

export async function pruneClosedYoutubeRooms(openTabIds: readonly number[]): Promise<void> {
  const openTabs = new Set(openTabIds);
  const localStorage = await storage.snapshot("local");
  const staleKeys = Object.keys(localStorage).filter((key) => {
    if (!key.startsWith(ACTIVE_ROOM_KEY_PREFIX)) return false;
    const tabId = Number(key.slice(ACTIVE_ROOM_KEY_PREFIX.length));
    return !Number.isInteger(tabId) || !openTabs.has(tabId);
  });

  if (staleKeys.length > 0) {
    await storage.removeItems(staleKeys.map((key) => `local:${key}` as `local:${string}`));
  }
}

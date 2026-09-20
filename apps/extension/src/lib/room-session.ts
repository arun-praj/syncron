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

export function closedYoutubeRoomTabIds(
  roomTabIds: readonly number[],
  openTabIds: readonly number[],
): number[] {
  const openTabs = new Set(openTabIds);
  return roomTabIds.filter((tabId) => !openTabs.has(tabId));
}

export async function listActiveYoutubeRooms(): Promise<
  Array<{ tabId: number; record: ActiveYoutubeRoomRecord }>
> {
  const localStorage = await storage.snapshot("local");
  const entries = await Promise.all(
    Object.keys(localStorage)
      .filter((key) => key.startsWith(ACTIVE_ROOM_KEY_PREFIX))
      .map(async (key) => {
        const tabId = Number(key.slice(ACTIVE_ROOM_KEY_PREFIX.length));
        const record = Number.isInteger(tabId) ? await getActiveYoutubeRoom(tabId) : null;
        return record ? { tabId, record } : null;
      }),
  );
  return entries.filter((entry): entry is { tabId: number; record: ActiveYoutubeRoomRecord } => entry !== null);
}

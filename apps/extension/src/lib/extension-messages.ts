export const OPEN_SERVICE_TAB = "syncron:open-service-tab" as const;
export const OPEN_YOUTUBE_SIDEBAR = "syncron:open-youtube-sidebar" as const;
export const YOUTUBE_CONTENT_READY = "syncron:youtube-content-ready" as const;
export const ACTIVATE_YOUTUBE_SIDEBAR = "syncron:activate-youtube-sidebar" as const;
export const YOUTUBE_API_REQUEST = "syncron:youtube-api-request" as const;
// Sent by the GET /join page (an ordinary web page, not part of the
// extension) via `chrome.runtime.sendMessage(EXTENSION_ID, ...)`, gated by
// the `externally_connectable` manifest entry — only origins listed there
// can reach this listener at all, but the payload is still untrusted input.
export const SYNCRON_PING = "syncron:ping" as const;
export const SYNCRON_PREVIEW_INVITE = "syncron:preview-invite" as const;
export const SYNCRON_JOIN_INVITE = "syncron:join-invite" as const;

export interface OpenServiceTabMessage {
  type: typeof OPEN_SERVICE_TAB;
  href: string;
  serviceId: "YOUTUBE" | "SPOTIFY" | "NETFLIX";
}

export interface YoutubeContentReadyMessage {
  type: typeof YOUTUBE_CONTENT_READY;
}

export interface OpenYoutubeSidebarMessage {
  type: typeof OPEN_YOUTUBE_SIDEBAR;
  tabId: number;
}

export interface YoutubeApiRequestMessage {
  type: typeof YOUTUBE_API_REQUEST;
  path: string;
  method: "GET" | "POST" | "PATCH";
  body?: string;
}

// Minimal, already-normalized snapshot the joining member's RoomScreen
// needs — built by the background script from several API responses so
// the content script doesn't need to know API/protocol shapes at all.
export interface JoinedRoomMemberSeed {
  id: string;
  name: string;
  username?: string;
  avatarId: string;
  isHost: boolean;
}

export interface JoinedRoomSnapshot {
  roomId: string;
  isHost: boolean;
  everyoneCanControl: boolean;
  allowMembersToShareInvite: boolean;
  inviteUrl: string | null;
  members: JoinedRoomMemberSeed[];
  selfUserId: string;
  initialMicrophoneEnabled?: boolean;
  initialCameraEnabled?: boolean;
}

export function withInitialDevicePreferences(
  snapshot: JoinedRoomSnapshot,
  preferences?: Pick<JoinedRoomSnapshot, "initialMicrophoneEnabled" | "initialCameraEnabled">,
): JoinedRoomSnapshot {
  return preferences === undefined ? snapshot : { ...snapshot, ...preferences };
}

export interface YoutubeRoomRecovery {
  status: "reconnecting";
}

export interface ActivateYoutubeSidebarMessage {
  type: typeof ACTIVATE_YOUTUBE_SIDEBAR;
  tabId: number;
  joinedRoom?: JoinedRoomSnapshot;
  roomRecovery?: YoutubeRoomRecovery;
}

export interface SyncronPingMessage {
  type: typeof SYNCRON_PING;
}

export interface SyncronJoinInviteMessage {
  type: typeof SYNCRON_JOIN_INVITE;
  invite: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
}

export interface SyncronPreviewInviteMessage {
  type: typeof SYNCRON_PREVIEW_INVITE;
  invite: string;
}

function isServiceId(value: unknown): value is OpenServiceTabMessage["serviceId"] {
  return value === "YOUTUBE" || value === "SPOTIFY" || value === "NETFLIX";
}

export function isOpenServiceTabMessage(message: unknown): message is OpenServiceTabMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === OPEN_SERVICE_TAB &&
    typeof (message as { href?: unknown }).href === "string" &&
    isServiceId((message as { serviceId?: unknown }).serviceId)
  );
}

export function isYoutubeContentReadyMessage(message: unknown): message is YoutubeContentReadyMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === YOUTUBE_CONTENT_READY
  );
}

export function isOpenYoutubeSidebarMessage(
  message: unknown,
): message is OpenYoutubeSidebarMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === OPEN_YOUTUBE_SIDEBAR &&
    typeof (message as { tabId?: unknown }).tabId === "number"
  );
}

export function isYoutubeApiRequestMessage(message: unknown): message is YoutubeApiRequestMessage {
  if (typeof message !== "object" || message === null) return false;
  const value = message as { type?: unknown; path?: unknown; method?: unknown; body?: unknown };
  return value.type === YOUTUBE_API_REQUEST &&
    typeof value.path === "string" &&
    typeof value.method === "string" &&
    ["GET", "POST", "PATCH"].includes(value.method) &&
    (value.body === undefined || typeof value.body === "string");
}

export function isAllowedYoutubeApiRequest(message: unknown): message is YoutubeApiRequestMessage {
  if (!isYoutubeApiRequestMessage(message) || message.path.length > 256 ||
    (message.body !== undefined && message.body.length > 16384))
    return false;
  const roomId = "[A-Za-z0-9_-]{1,128}";
  const routes: Record<YoutubeApiRequestMessage["method"], RegExp[]> = {
    GET: [
      /^\/api\/v1\/me$/,
      /^\/api\/v1\/rooms\/previous$/,
      new RegExp(`^\\/api\\/v1\\/rooms\\/${roomId}$`),
      new RegExp(`^\\/api\\/v1\\/rooms\\/${roomId}\\/(members|invite)$`),
    ],
    POST: [
      /^\/api\/v1\/rooms$/,
      /^\/api\/v1\/me\/onboarding$/,
      /^\/api\/v1\/rooms\/(preview|join)$/,
      new RegExp(`^\\/api\\/v1\\/rooms\\/${roomId}\\/(rejoin|leave|end|ws-ticket|livekit-token)$`),
    ],
    PATCH: [
      /^\/api\/v1\/me$/,
      new RegExp(`^\\/api\\/v1\\/rooms\\/${roomId}\\/settings$`),
    ],
  };
  return routes[message.method].some((route) => route.test(message.path)) &&
    (message.method === "GET" ? message.body === undefined : message.body !== undefined);
}

export function isActivateYoutubeSidebarMessage(
  message: unknown,
): message is ActivateYoutubeSidebarMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === ACTIVATE_YOUTUBE_SIDEBAR &&
    typeof (message as { tabId?: unknown }).tabId === "number"
  );
}

export function isSyncronPingMessage(message: unknown): message is SyncronPingMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === SYNCRON_PING
  );
}

export function isSyncronJoinInviteMessage(
  message: unknown,
): message is SyncronJoinInviteMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === SYNCRON_JOIN_INVITE &&
    typeof (message as { invite?: unknown }).invite === "string" &&
    (message as { invite: string }).invite.length > 0 &&
    typeof (message as { microphoneEnabled?: unknown }).microphoneEnabled === "boolean" &&
    typeof (message as { cameraEnabled?: unknown }).cameraEnabled === "boolean"
  );
}

export function isSyncronPreviewInviteMessage(
  message: unknown,
): message is SyncronPreviewInviteMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === SYNCRON_PREVIEW_INVITE &&
    typeof (message as { invite?: unknown }).invite === "string" &&
    (message as { invite: string }).invite.length > 0
  );
}

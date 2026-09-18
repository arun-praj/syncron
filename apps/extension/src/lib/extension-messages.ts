export const OPEN_SERVICE_TAB = "syncron:open-service-tab" as const;
export const OPEN_YOUTUBE_SIDEBAR = "syncron:open-youtube-sidebar" as const;
export const YOUTUBE_CONTENT_READY = "syncron:youtube-content-ready" as const;
export const ACTIVATE_YOUTUBE_SIDEBAR = "syncron:activate-youtube-sidebar" as const;

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

export interface ActivateYoutubeSidebarMessage {
  type: typeof ACTIVATE_YOUTUBE_SIDEBAR;
  tabId: number;
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

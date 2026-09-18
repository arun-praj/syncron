import { describe, expect, it } from "vitest";

import {
  isActivateYoutubeSidebarMessage,
  isOpenYoutubeSidebarMessage,
  isOpenServiceTabMessage,
  isYoutubeContentReadyMessage,
} from "../apps/extension/src/lib/extension-messages.js";

describe("extension sidebar messages", () => {
  it("accepts only complete tab activation messages", () => {
    expect(isActivateYoutubeSidebarMessage({ type: "syncron:activate-youtube-sidebar", tabId: 12 })).toBe(true);
    expect(isActivateYoutubeSidebarMessage({ type: "syncron:activate-youtube-sidebar", tabId: "12" })).toBe(false);
    expect(isActivateYoutubeSidebarMessage({ type: "syncron:activate-youtube-sidebar" })).toBe(false);
  });

  it("keeps service-tab requests and content readiness distinguishable", () => {
    expect(
      isOpenServiceTabMessage({
        type: "syncron:open-service-tab",
        href: "https://www.youtube.com",
        serviceId: "YOUTUBE",
      }),
    ).toBe(true);
    expect(
      isOpenServiceTabMessage({
        type: "syncron:open-service-tab",
        href: "https://example.com",
        serviceId: "UNKNOWN",
      }),
    ).toBe(false);
    expect(isYoutubeContentReadyMessage({ type: "syncron:youtube-content-ready" })).toBe(true);
    expect(isYoutubeContentReadyMessage({ type: "syncron:open-service-tab" })).toBe(false);
  });

  it("accepts only a numeric current-tab sidebar request", () => {
    expect(isOpenYoutubeSidebarMessage({ type: "syncron:open-youtube-sidebar", tabId: 12 })).toBe(true);
    expect(isOpenYoutubeSidebarMessage({ type: "syncron:open-youtube-sidebar", tabId: "12" })).toBe(false);
  });
});

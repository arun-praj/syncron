import { storage } from "wxt/utils/storage";

import {
  ACTIVATE_YOUTUBE_SIDEBAR,
  isOpenYoutubeSidebarMessage,
  isOpenServiceTabMessage,
  isYoutubeContentReadyMessage,
} from "@/lib/extension-messages";

const TARGET_TABS_KEY = "session:syncronTargetYoutubeTabs" as const;

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

async function activateYoutubeTab(tabId: number): Promise<void> {
  await setTargetTab(tabId);
  await browser.tabs
    .sendMessage(tabId, { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId })
    .catch(() => undefined);
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
      return isTargetTab(sender.tab.id).then((target) =>
        target
          ? { type: ACTIVATE_YOUTUBE_SIDEBAR, tabId: sender.tab!.id! }
          : undefined,
      );
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void clearTargetTab(tabId);
  });

  browser.runtime.onInstalled.addListener(() => {
    console.log("[Syncron] background service worker ready");
  });
});

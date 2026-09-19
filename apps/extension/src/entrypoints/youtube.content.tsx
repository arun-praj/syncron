import { createRoot, type Root } from "react-dom/client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import {
  isActivateYoutubeSidebarMessage,
  YOUTUBE_CONTENT_READY,
  type ActivateYoutubeSidebarMessage,
  type JoinedRoomSnapshot,
} from "@/lib/extension-messages";
import { readPagePlaybackSnapshot } from "@/lib/page-playback";
import { isPlaybackSnapshotRequest } from "@/lib/playback-messages";
import { STREAMING_SERVICES } from "@/lib/streaming-services";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PartySetupScreen from "@/screens/PartySetupScreen";
import RoomScreen from "@/screens/RoomScreen";
import { watchStoredSession } from "@/services/auth/client";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore, type RoomIdentity } from "@/stores/room-store";

import "@/style.css";

const YOUTUBE = STREAMING_SERVICES.find((service) => service.id === "YOUTUBE")!;
const SIDEBAR_WIDTH = 380;

function useYoutubeTabContext(tabId: number) {
  const [context, setContext] = useState(() => ({
    tabTitle: document.title.replace(/ - YouTube$/, "") || YOUTUBE.name,
    tabUrl: location.href,
  }));

  useEffect(() => {
    const refresh = () =>
      setContext({
        tabTitle: document.title.replace(/ - YouTube$/, "") || YOUTUBE.name,
        tabUrl: location.href,
      });

    window.addEventListener("popstate", refresh);
    window.addEventListener("yt-navigate-finish", refresh);
    return () => {
      window.removeEventListener("popstate", refresh);
      window.removeEventListener("yt-navigate-finish", refresh);
    };
  }, [tabId]);

  return context;
}

function useYoutubePageLayout(open: boolean) {
  useEffect(() => {
    const app = document.querySelector<HTMLElement>("ytd-app");
    if (!app || !open) return;

    const previousMarginRight = app.style.marginRight;
    const previousWidth = app.style.width;
    app.style.marginRight = `${SIDEBAR_WIDTH}px`;
    app.style.width = `calc(100% - ${SIDEBAR_WIDTH}px)`;

    return () => {
      app.style.marginRight = previousMarginRight;
      app.style.width = previousWidth;
    };
  }, [open]);
}

function SidebarFrame({
  open,
  onClose,
  onOpen,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <aside
        aria-label="Syncron"
        className={`fixed right-0 top-0 z-[2147483647] h-screen w-[380px] flex-col border-l border-border bg-bg font-sans shadow-2xl ${
          open ? "flex" : "hidden"
        }`}>
        <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-border bg-white px-4">
          <span className="text-[14px] font-bold text-ink-primary">Syncron</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Minimize Syncron"
            className="rounded-md px-2 py-1 text-[12px] text-ink-secondary hover:bg-neutral-100 hover:text-ink-primary">
            Hide
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
      {!open && (
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open Syncron sidebar"
          className="fixed right-3 top-1/2 z-[2147483647] -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-top to-brand-bottom px-3 py-2 font-sans text-[12px] font-semibold text-white shadow-btn-primary">
          Syncron
        </button>
      )}
    </>
  );
}

function joinedRoomToIdentity(snapshot: JoinedRoomSnapshot, tabId: number, tabTitle: string): RoomIdentity {
  return {
    service: YOUTUBE,
    tabId,
    tabTitle,
    roomId: snapshot.roomId,
    isHost: snapshot.isHost,
    everyoneCanControl: snapshot.everyoneCanControl,
    canShareInvite: snapshot.isHost || snapshot.allowMembersToShareInvite,
    inviteUrl: snapshot.inviteUrl,
    members: snapshot.members,
    selfUserId: snapshot.selfUserId,
  };
}

function SyncronSidebar({
  tabId,
  initialJoinedRoom,
}: {
  tabId: number;
  initialJoinedRoom?: JoinedRoomSnapshot;
}) {
  const { status, hydrate } = useAuthStore();
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState<"setup" | "room">(initialJoinedRoom ? "room" : "setup");
  const enterRoom = useRoomStore((s) => s.enterRoom);
  const context = useYoutubeTabContext(tabId);
  const readSnapshot = useCallback(async () => readPagePlaybackSnapshot(), []);

  useYoutubePageLayout(open);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => watchStoredSession(() => void hydrate()), [hydrate]);

  // Applies once for a tab opened specifically to land a just-joined
  // member — background.ts only attaches `joinedRoom` to the very first
  // activation message a freshly created tab receives.
  const appliedInitialJoin = useRef(false);
  useEffect(() => {
    if (!initialJoinedRoom || appliedInitialJoin.current) return;
    appliedInitialJoin.current = true;
    enterRoom(joinedRoomToIdentity(initialJoinedRoom, tabId, context.tabTitle));
  }, [initialJoinedRoom, tabId, context.tabTitle, enterRoom]);

  useEffect(() => {
    const onActivation = (message: unknown) => {
      if (!isActivateYoutubeSidebarMessage(message) || message.tabId !== tabId) return;
      setOpen(true);
      if (message.joinedRoom) {
        enterRoom(joinedRoomToIdentity(message.joinedRoom, tabId, context.tabTitle));
        setPage("room");
      }
    };

    browser.runtime.onMessage.addListener(onActivation);
    return () => browser.runtime.onMessage.removeListener(onActivation);
  }, [tabId, context.tabTitle, enterRoom]);

  const setup = useMemo(
    () => (
      <PartySetupScreen
        service={YOUTUBE}
        tabId={tabId}
        tabTitle={context.tabTitle}
        tabUrl={context.tabUrl}
        readPlaybackSnapshot={readSnapshot}
        onBack={() => setOpen(false)}
        onEnterRoom={() => setPage("room")}
      />
    ),
    [context.tabTitle, context.tabUrl, readSnapshot, tabId],
  );

  let content: ReactNode;
  if (status === "loading") {
    content = <div className="flex min-h-full items-center justify-center text-subtext text-ink-secondary">Loading…</div>;
  } else if (status === "unavailable") {
    content = (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center text-subtext text-ink-secondary">
        <p>Couldn’t verify your session.</p>
        <button type="button" onClick={() => void hydrate()} className="mt-3 text-accent hover:underline">
          Try again
        </button>
      </div>
    );
  } else if (status === "signed-out" || status === "needs-verification") {
    content = (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-h1 font-bold text-ink-primary">Open Syncron</h1>
        <p className="mt-2 text-subtext text-ink-secondary">Use the extension popup to sign in and continue.</p>
      </div>
    );
  } else if (status === "needs-onboarding") {
    content = <OnboardingScreen />;
  } else if (page === "room") {
    content = <RoomScreen onBack={() => setPage("setup")} onLeave={() => setPage("setup")} />;
  } else {
    content = setup;
  }

  return (
    <SidebarFrame open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)}>
      {content}
    </SidebarFrame>
  );
}

async function waitForYoutubeActivation(): Promise<ActivateYoutubeSidebarMessage | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (activation?: ActivateYoutubeSidebarMessage) => {
      if (settled) return;
      settled = true;
      browser.runtime.onMessage.removeListener(onMessage);
      resolve(activation);
    };
    const onMessage = (message: unknown) => {
      if (isActivateYoutubeSidebarMessage(message)) finish(message);
    };

    browser.runtime.onMessage.addListener(onMessage);
    void browser.runtime
      .sendMessage({ type: YOUTUBE_CONTENT_READY })
      .then((message) => {
        if (isActivateYoutubeSidebarMessage(message)) finish(message);
      })
      .catch(() => undefined);
  });
}

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    browser.runtime.onMessage.addListener((message) => {
      if (!isPlaybackSnapshotRequest(message)) return;
      return Promise.resolve(readPagePlaybackSnapshot());
    });

    const activation = await waitForYoutubeActivation();
    if (!isActivateYoutubeSidebarMessage(activation)) return;

    const ui = await createShadowRootUi(ctx, {
      name: "syncron-sidebar",
      position: "inline",
      anchor: "body",
      onMount(container): Root {
        const root = createRoot(container);
        root.render(<SyncronSidebar tabId={activation.tabId} initialJoinedRoom={activation.joinedRoom} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});

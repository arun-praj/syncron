import { useEffect, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import { useDetectedStreamingTab } from "@/hooks/useDetectedStreamingTab";
import { OPEN_SERVICE_TAB } from "@/lib/extension-messages";
import type { StreamingService } from "@/lib/streaming-services";
import HomeScreen from "@/screens/HomeScreen";
import HowItWorksScreen from "@/screens/HowItWorksScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PartySetupScreen from "@/screens/PartySetupScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import RoomScreen from "@/screens/RoomScreen";
import { useAuthStore } from "@/stores/auth-store";

async function openService(service: StreamingService) {
  await browser.runtime.sendMessage({
    type: OPEN_SERVICE_TAB,
    href: service.href,
    serviceId: service.id,
  });
}

// "auto" defers to the currently detected tab (party setup on a supported
// streaming site, Home otherwise). Explicit pages are user navigation and
// take priority over that detection until the user backs out again.
type Page = "auto" | "home" | "profile" | "how-it-works" | "room";

interface ActiveRoom {
  inviteUrl: string;
  service: StreamingService;
  tabId: number;
  tabTitle: string;
}

export default function App() {
  const { status, hydrate } = useAuthStore();
  const [page, setPage] = useState<Page>("auto");
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const detected = useDetectedStreamingTab();

  useEffect(() => {
    void hydrate();
  }, []);

  let content: ReactNode;
  if (status === "loading") {
    content = (
      <div className="flex min-h-screen items-center justify-center text-subtext text-ink-secondary">
        Loading…
      </div>
    );
  } else if (status === "signed-out" || status === "needs-verification") {
    content = (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-h1 font-bold text-ink-primary">Open Syncron</h1>
        <p className="mt-2 text-subtext text-ink-secondary">
          Use the extension popup to sign in and continue.
        </p>
      </div>
    );
  } else if (status === "needs-onboarding") {
    content = <OnboardingScreen />;
  } else if (page === "profile") {
    content = <ProfileScreen onBack={() => setPage("auto")} />;
  } else if (page === "how-it-works") {
    content = <HowItWorksScreen onBack={() => setPage("auto")} />;
  } else if (page === "room" && activeRoom) {
    content = (
      <RoomScreen
        service={activeRoom.service}
        tabId={activeRoom.tabId}
        tabTitle={activeRoom.tabTitle}
        inviteUrl={activeRoom.inviteUrl}
        onBack={() => setPage("auto")}
        onLeave={() => {
          setActiveRoom(null);
          setPage("home");
        }}
      />
    );
  } else if (page === "home" || detected === null) {
    content = (
      <HomeScreen
        onOpenProfile={() => setPage("profile")}
        onOpenService={(service) => void openService(service)}
        onOpenHowItWorks={() => setPage("how-it-works")}
      />
    );
  } else if (detected === "loading") {
    content = null;
  } else {
    content = (
      <PartySetupScreen
        service={detected.service}
        tabId={detected.tabId}
        tabTitle={detected.title}
        tabUrl={detected.url}
        onBack={() => setPage("home")}
        onEnterRoom={(inviteUrl) => {
          setActiveRoom({
            inviteUrl,
            service: detected.service,
            tabId: detected.tabId,
            tabTitle: detected.title,
          });
          setPage("room");
        }}
      />
    );
  }

  return <div className="h-full overflow-y-auto bg-bg font-sans">{content}</div>;
}

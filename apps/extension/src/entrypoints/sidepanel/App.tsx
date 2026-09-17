import { useEffect, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import { useDetectedStreamingTab } from "@/hooks/useDetectedStreamingTab";
import HomeScreen from "@/screens/HomeScreen";
import HowItWorksScreen from "@/screens/HowItWorksScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PartySetupScreen from "@/screens/PartySetupScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { useAuthStore } from "@/stores/auth-store";

async function openService(href: string) {
  await browser.tabs.create({ url: href, active: true });
}

// "auto" defers to the currently detected tab (party setup on a supported
// streaming site, Home otherwise). Explicit pages are user navigation and
// take priority over that detection until the user backs out again.
type Page = "auto" | "home" | "profile" | "how-it-works";

export default function App() {
  const { status, hydrate } = useAuthStore();
  const [page, setPage] = useState<Page>("auto");
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
  } else if (page === "home" || detected === null) {
    content = (
      <HomeScreen
        onOpenProfile={() => setPage("profile")}
        onOpenService={(href) => void openService(href)}
        onOpenHowItWorks={() => setPage("how-it-works")}
      />
    );
  } else if (detected === "loading") {
    content = null;
  } else {
    content = (
      <PartySetupScreen
        service={detected.service}
        tabTitle={detected.title}
        tabUrl={detected.url}
        onBack={() => setPage("home")}
      />
    );
  }

  return <div className="min-h-screen bg-bg font-sans">{content}</div>;
}

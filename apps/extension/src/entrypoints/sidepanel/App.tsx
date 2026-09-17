import { useEffect, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import HomeScreen from "@/screens/HomeScreen";
import HowItWorksScreen from "@/screens/HowItWorksScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { useAuthStore } from "@/stores/auth-store";

async function openService(href: string) {
  await browser.tabs.create({ url: href, active: true });
}

export default function App() {
  const { status, hydrate } = useAuthStore();
  const [page, setPage] = useState<"home" | "profile" | "how-it-works">("home");

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
    content = <ProfileScreen onBack={() => setPage("home")} />;
  } else if (page === "how-it-works") {
    content = <HowItWorksScreen onBack={() => setPage("home")} />;
  } else {
    content = (
      <HomeScreen
        onOpenProfile={() => setPage("profile")}
        onOpenService={(href) => void openService(href)}
        onOpenHowItWorks={() => setPage("how-it-works")}
      />
    );
  }

  return <div className="min-h-screen bg-bg font-sans">{content}</div>;
}

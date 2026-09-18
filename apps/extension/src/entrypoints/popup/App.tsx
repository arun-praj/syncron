import { useEffect, useRef, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import { useDetectedStreamingTab } from "@/hooks/useDetectedStreamingTab";
import { OPEN_SERVICE_TAB, OPEN_YOUTUBE_SIDEBAR } from "@/lib/extension-messages";
import type { StreamingService } from "@/lib/streaming-services";
import HomeScreen from "@/screens/HomeScreen";
import HowItWorksScreen from "@/screens/HowItWorksScreen";
import LoginScreen from "@/screens/LoginScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import SignupScreen from "@/screens/SignupScreen";
import { watchStoredSession } from "@/services/auth/client";
import { useAuthStore } from "@/stores/auth-store";

async function openVerificationTab() {
  const url = browser.runtime.getURL("/verify.html");
  const existing = (await browser.tabs.query({ url }))[0];
  if (existing?.id !== undefined) {
    await browser.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) await browser.windows.update(existing.windowId, { focused: true });
    return;
  }
  await browser.tabs.create({ url });
}

async function openService(service: StreamingService) {
  await browser.runtime.sendMessage({
    type: OPEN_SERVICE_TAB,
    href: service.href,
    serviceId: service.id,
  });
}

// "auto" opens the in-page sidebar for the active YouTube tab. The popup
// remains the auth/home entry point rather than hosting party state itself.
type Page = "auto" | "home" | "profile" | "how-it-works";

export default function App() {
  const { status, hydrate } = useAuthStore();
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [page, setPage] = useState<Page>("auto");
  const detected = useDetectedStreamingTab();
  const openedVerificationTab = useRef(false);
  const openedYoutubeTab = useRef<number | null>(null);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => watchStoredSession(() => void hydrate()), [hydrate]);

  useEffect(() => {
    if (status !== "needs-verification" || openedVerificationTab.current) return;
    openedVerificationTab.current = true;
    void openVerificationTab().then(() => window.close());
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || page !== "auto" || detected === "loading" || !detected) return;
    if (detected.service.id !== "YOUTUBE" || openedYoutubeTab.current === detected.tabId) return;

    openedYoutubeTab.current = detected.tabId;
    void browser.runtime
      .sendMessage({ type: OPEN_YOUTUBE_SIDEBAR, tabId: detected.tabId })
      .then(() => window.close())
      .catch(() => {
        openedYoutubeTab.current = null;
      });
  }, [detected, page, status]);

  let content: ReactNode;
  if (status === "loading") {
    content = (
      <div className="flex h-full items-center justify-center text-subtext text-ink-secondary">
        Loading…
      </div>
    );
  } else if (status === "signed-out") {
    content =
      authView === "login" ? (
        <LoginScreen onSwitchToSignup={() => setAuthView("signup")} />
      ) : (
        <SignupScreen onSwitchToLogin={() => setAuthView("login")} />
      );
  } else if (status === "needs-verification") {
    content = (
      <div className="flex h-full items-center justify-center px-8 text-center text-subtext text-ink-secondary">
        Opening email verification…
      </div>
    );
  } else if (status === "unavailable") {
    content = (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center text-subtext text-ink-secondary">
        <p>Couldn’t verify your session.</p>
        <button type="button" onClick={() => void hydrate()} className="mt-3 text-accent hover:underline">
          Try again
        </button>
      </div>
    );
  } else if (status === "needs-onboarding") {
    content = <OnboardingScreen />;
  } else if (page === "profile") {
    content = <ProfileScreen onBack={() => setPage("auto")} />;
  } else if (page === "how-it-works") {
    content = <HowItWorksScreen onBack={() => setPage("auto")} />;
  } else if (
    page === "home" ||
    detected === null ||
    detected === "loading" ||
    detected.service.id !== "YOUTUBE"
  ) {
    content = (
      <HomeScreen
        onOpenProfile={() => setPage("profile")}
        onOpenService={(service) => void openService(service)}
        onOpenHowItWorks={() => setPage("how-it-works")}
      />
    );
  } else {
    content = <div className="flex h-full items-center justify-center text-subtext text-ink-secondary">Opening Syncron…</div>;
  }

  const resolvedView =
    page === "auto"
      ? detected !== null && detected !== "loading" && detected.service.id === "YOUTUBE"
        ? "opening"
        : "home"
      : page;
  const viewKey =
    status === "signed-out"
      ? `signed-out-${authView}`
      : status === "ready"
        ? `ready-${resolvedView}`
        : status;

  return (
    <div className="h-[600px] w-[400px] overflow-y-auto bg-bg font-sans">
      <div key={viewKey} className="h-full motion-screen">
        {content}
      </div>
    </div>
  );
}

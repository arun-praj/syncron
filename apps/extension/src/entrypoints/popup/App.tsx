import { useEffect, useRef, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import { useDetectedStreamingTab } from "@/hooks/useDetectedStreamingTab";
import HomeScreen from "@/screens/HomeScreen";
import HowItWorksScreen from "@/screens/HowItWorksScreen";
import LoginScreen from "@/screens/LoginScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PartySetupScreen from "@/screens/PartySetupScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import SignupScreen from "@/screens/SignupScreen";
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

async function openServiceInSidePanel(href: string) {
  const tab = await browser.tabs.create({ url: href, active: true });
  if (tab.id === undefined) return;

  await browser.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel.html",
    enabled: true,
  });
  await browser.sidePanel.open({ tabId: tab.id });
}

// "auto" defers to the currently detected tab (party setup on a supported
// streaming site, Home otherwise). Explicit pages are user navigation and
// take priority over that detection until the user backs out again.
type Page = "auto" | "home" | "profile" | "how-it-works";

export default function App() {
  const { status, hydrate } = useAuthStore();
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [page, setPage] = useState<Page>("auto");
  const detected = useDetectedStreamingTab();
  const openedVerificationTab = useRef(false);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (status !== "needs-verification" || openedVerificationTab.current) return;
    openedVerificationTab.current = true;
    void openVerificationTab().then(() => window.close());
  }, [status]);

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
        onOpenService={(href) => void openServiceInSidePanel(href)}
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
      />
    );
  }

  const resolvedView = page === "auto" ? (detected === "loading" ? "loading" : detected ? "party-setup" : "home") : page;
  const viewKey =
    status === "signed-out"
      ? `signed-out-${authView}`
      : status === "ready"
        ? `ready-${resolvedView}`
        : status;

  return (
    <div className="h-[600px] w-[400px] overflow-y-auto bg-bg font-sans">
      <div key={viewKey} className="motion-screen">
        {content}
      </div>
    </div>
  );
}

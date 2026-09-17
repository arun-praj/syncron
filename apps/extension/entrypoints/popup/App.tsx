import { useEffect, useRef, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import HomeScreen from "@/src/screens/HomeScreen";
import LoginScreen from "@/src/screens/LoginScreen";
import OnboardingScreen from "@/src/screens/OnboardingScreen";
import ProfileScreen from "@/src/screens/ProfileScreen";
import SignupScreen from "@/src/screens/SignupScreen";
import { useAuthStore } from "@/src/stores/auth-store";

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

export default function App() {
  const { status, user, bootstrap } = useAuthStore();
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [page, setPage] = useState<"home" | "profile">("home");
  const openedVerificationTab = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (status !== "awaiting-verification" || openedVerificationTab.current) return;
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
  } else if (status === "awaiting-verification") {
    content = (
      <div className="flex h-full items-center justify-center px-8 text-center text-subtext text-ink-secondary">
        Opening email verification…
      </div>
    );
  } else if (!user?.onboardingCompletedAt) {
    content = <OnboardingScreen />;
  } else if (page === "profile") {
    content = <ProfileScreen onBack={() => setPage("home")} />;
  } else {
    content = (
      <HomeScreen
        onOpenProfile={() => setPage("profile")}
        onOpenService={(href) => void openServiceInSidePanel(href)}
      />
    );
  }

  const viewKey =
    status === "signed-out"
      ? `signed-out-${authView}`
      : status === "signed-in"
        ? `signed-in-${page}`
        : status;

  return (
    <div className="h-[600px] w-[400px] overflow-y-auto bg-bg font-sans">
      <div key={viewKey} className="motion-screen">
        {content}
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { browser } from "wxt/browser";

import VerifyOtpScreen from "@/screens/VerifyOtpScreen";
import LoginScreen from "@/screens/LoginScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import SignupScreen from "@/screens/SignupScreen";
import { setAuthResult } from "@/services/auth/client";
import { useAuthStore } from "@/stores/auth-store";

async function closeTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
}

export default function App() {
  const { status, hydrate, backToSignIn, info } = useAuthStore();
  const [authView, setAuthView] = useState<"login" | "signup">(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login",
  );
  const [reportedSuccess, setReportedSuccess] = useState(false);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (status !== "ready" || reportedSuccess) return;
    setReportedSuccess(true);
    void setAuthResult(info ?? "Sign in success");
  }, [info, reportedSuccess, status]);

  let content: ReactNode;
  if (status === "loading") {
    content = (
      <div className="flex h-screen items-center justify-center text-subtext text-ink-secondary">
        Loading…
      </div>
    );
  } else if (status === "needs-verification") {
    content = <VerifyOtpScreen onBack={() => backToSignIn()} />;
  } else if (status === "needs-onboarding") {
    content = <OnboardingScreen />;
  } else if (status === "signed-out") {
    content = (
      authView === "login" ? (
        <LoginScreen onSwitchToSignup={() => setAuthView("signup")} />
      ) : (
        <SignupScreen onSwitchToLogin={() => setAuthView("login")} />
      )
    );
  } else if (status === "unavailable") {
    content = (
      <div className="flex h-screen flex-col items-center justify-center px-8 text-center text-subtext text-ink-secondary">
        <p>Couldn’t verify your session.</p>
        <button type="button" onClick={() => void hydrate()} className="mt-3 text-accent hover:underline">
          Try again
        </button>
      </div>
    );
  } else if (status === "ready") {
    content = (
      <div className="flex min-h-screen flex-col items-center px-[22px] pb-[18px] pt-[26px] text-center">
        <h1 className="mb-2 text-h1 font-bold text-ink-primary">{info ?? "Sign in success"}</h1>
        <p className="text-subtext text-ink-secondary">
          You can close this tab and return to the Syncron extension.
        </p>
        <button
          type="button"
          onClick={() => void closeTab()}
          className="mt-5 text-footer text-ink-secondary hover:text-ink-primary hover:underline">
          Close this tab
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg font-sans">
      <div key={status} className="motion-screen mx-auto w-[400px] max-w-full">
        {content}
      </div>
    </div>
  );
}

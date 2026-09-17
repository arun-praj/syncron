import { useEffect, useState, type ReactNode } from "react";

import HomeScreen from "@/src/screens/HomeScreen";
import LoginScreen from "@/src/screens/LoginScreen";
import OnboardingScreen from "@/src/screens/OnboardingScreen";
import SignupScreen from "@/src/screens/SignupScreen";
import VerifyOtpScreen from "@/src/screens/VerifyOtpScreen";
import { useAuthStore } from "@/src/stores/auth-store";

export default function App() {
  const { status, user, bootstrap, cancelVerification } = useAuthStore();
  const [authView, setAuthView] = useState<"login" | "signup">("login");

  useEffect(() => {
    void bootstrap();
  }, []);

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
      <VerifyOtpScreen
        onBack={() => {
          cancelVerification();
          setAuthView("signup");
        }}
      />
    );
  } else if (!user?.onboardingCompletedAt) {
    content = <OnboardingScreen />;
  } else {
    content = <HomeScreen />;
  }

  return <div className="h-[600px] w-[400px] overflow-y-auto bg-bg font-sans">{content}</div>;
}

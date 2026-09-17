// TEMPORARY, throwaway visual-QA harness — not part of the shipped
// extension. Seeds the real Zustand store directly and renders the real
// screen components, so each screen/state can be screenshotted without a
// live backend. Delete this whole `preview/` entrypoint when done.
import HomeScreen from "@/screens/HomeScreen";
import LoginScreen from "@/screens/LoginScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import SignupScreen from "@/screens/SignupScreen";
import VerifyOtpScreen from "@/screens/VerifyOtpScreen";
import { useAuthStore, type SyncronUser } from "@/stores/auth-store";

const mockUser: SyncronUser = {
  id: "u1",
  username: "jamie_rivera",
  avatarId: "7",
  displayName: "Jamie Rivera",
  image: null,
  email: "jamie@example.com",
  emailVerified: true,
  createdAt: new Date().toISOString(),
  onboardingCompletedAt: new Date().toISOString(),
};

const screen = new URLSearchParams(window.location.search).get("screen") ?? "login";

switch (screen) {
  case "login":
    useAuthStore.setState({ status: "signed-out", user: null, error: null, info: null });
    break;
  case "signup":
    useAuthStore.setState({ status: "signed-out", user: null, error: null, info: null });
    break;
  case "verify-otp":
    useAuthStore.setState({
      status: "needs-verification",
      pendingEmail: "jamie@example.com",
      error: null,
      info: null,
    });
    break;
  case "verify-otp-error":
    useAuthStore.setState({
      status: "needs-verification",
      pendingEmail: "jamie@example.com",
      error: "That code isn't right. Try again.",
      info: null,
    });
    break;
  case "onboarding":
    useAuthStore.setState({ status: "needs-onboarding", user: null, error: null, info: null });
    break;
  case "home":
    useAuthStore.setState({ status: "ready", user: mockUser, error: null, info: null });
    break;
  case "profile":
    useAuthStore.setState({ status: "ready", user: mockUser, error: null, info: null });
    break;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f4f4f5",
      }}>
      <div
        className="bg-bg font-sans"
        style={{
          width: 400,
          height: 600,
          overflowY: "auto",
          boxShadow: "0 0 0 1px #e4e4e7, 0 20px 40px rgba(0,0,0,.08)",
        }}>
        {children}
      </div>
    </div>
  );
}

function Screen() {
  switch (screen) {
    case "login":
      return <LoginScreen onSwitchToSignup={() => {}} />;
    case "signup":
      return <SignupScreen onSwitchToLogin={() => {}} />;
    case "verify-otp":
    case "verify-otp-error":
      return <VerifyOtpScreen onBack={() => {}} />;
    case "onboarding":
      return <OnboardingScreen />;
    case "home":
      return <HomeScreen onOpenProfile={() => {}} onOpenHowItWorks={() => {}} />;
    case "profile":
      return <ProfileScreen onBack={() => {}} />;
    default:
      return <div>Unknown screen: {screen}</div>;
  }
}

export default function App() {
  return (
    <Frame>
      <Screen />
    </Frame>
  );
}

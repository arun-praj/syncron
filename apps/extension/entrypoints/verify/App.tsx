import { useEffect, type ReactNode } from "react";
import { browser } from "wxt/browser";

import VerifyOtpScreen from "@/src/screens/VerifyOtpScreen";
import { useAuthStore } from "@/src/stores/auth-store";

async function closeTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
}

export default function App() {
  const { status, bootstrap, cancelVerification } = useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, []);

  let content: ReactNode;
  if (status === "loading") {
    content = (
      <div className="flex h-screen items-center justify-center text-subtext text-ink-secondary">
        Loading…
      </div>
    );
  } else if (status === "awaiting-verification") {
    content = <VerifyOtpScreen onBack={() => void cancelVerification()} />;
  } else if (status === "verification-complete") {
    content = (
      <div className="flex min-h-screen flex-col items-center px-[22px] pb-[18px] pt-[26px] text-center">
        <h1 className="mb-2 text-h1 font-bold text-ink-primary">Email verified</h1>
        <p className="text-subtext text-ink-secondary">
          Your email has been verified. Open the Syncron extension popup and sign in to continue.
        </p>
        <button
          type="button"
          onClick={() => void closeTab()}
          className="mt-5 text-footer text-ink-secondary hover:text-ink-primary hover:underline">
          Close this tab
        </button>
      </div>
    );
  } else {
    content = (
      <div className="flex min-h-screen flex-col items-center px-[22px] pb-[18px] pt-[26px] text-center">
        <h1 className="mb-2 text-h1 font-bold text-ink-primary">Open Syncron</h1>
        <p className="text-subtext text-ink-secondary">
          Use the extension popup to sign in and continue.
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

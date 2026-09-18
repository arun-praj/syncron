// TEMPORARY, throwaway visual-QA harness — not part of the shipped
// extension. Renders RoomScreen full-width (simulating the fixed 380px
// YouTube in-page sidebar on a large monitor) so the button-contrast fix
// and the reaction-picker crash fix can be verified visually. Delete this
// whole `preview2/` entrypoint when done.
import RoomScreen from "@/screens/RoomScreen";
import { STREAMING_SERVICES } from "@/lib/streaming-services";

const YOUTUBE = STREAMING_SERVICES.find((s) => s.id === "YOUTUBE")!;

export default function App() {
  return (
    <div style={{ height: "100vh", width: 380, background: "#fff" }}>
      <RoomScreen
        service={YOUTUBE}
        tabId={1}
        tabTitle="Daft Punk - One More Time (Official Video)"
        inviteUrl="https://app.syncron.example/join#invite=preview"
        onBack={() => {}}
        onLeave={() => {}}
      />
    </div>
  );
}

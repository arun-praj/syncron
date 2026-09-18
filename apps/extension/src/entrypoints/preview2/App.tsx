// TEMPORARY, throwaway visual-QA harness — not part of the shipped
// extension. Renders RoomScreen inside a horizontally-resizable box (drag
// the bottom-right corner) so its fluid/container-query layout can be
// eyeballed across widths, without going through auth/tab-detection.
// Delete this whole `preview2/` entrypoint when done.
import { useEffect } from "react";

import RoomScreen from "@/screens/RoomScreen";
import { STREAMING_SERVICES } from "@/lib/streaming-services";
import { useRoomStore } from "@/stores/room-store";

const YOUTUBE = STREAMING_SERVICES.find((s) => s.id === "YOUTUBE")!;

export default function App() {
  const enterRoom = useRoomStore((s) => s.enterRoom);

  useEffect(() => {
    enterRoom({
      service: YOUTUBE,
      tabId: 1,
      tabTitle: "Daft Punk - One More Time (Official Video)",
      roomId: "preview-room",
      isHost: true,
      everyoneCanControl: false,
      canShareInvite: true,
      inviteUrl: "https://app.syncron.example/join#invite=preview",
      members: [{ id: "you", name: "You", avatarId: "1", isHost: true }],
    });
  }, [enterRoom]);

  return (
    <div style={{ height: "100vh", background: "#e4e4e7", padding: 16 }}>
      <div
        style={{
          height: "calc(100vh - 32px)",
          width: 400,
          minWidth: 280,
          maxWidth: "100%",
          resize: "horizontal",
          overflow: "auto",
          background: "#fff",
          boxShadow: "0 0 0 1px #e4e4e7",
        }}>
        <RoomScreen onBack={() => {}} onLeave={() => {}} />
      </div>
    </div>
  );
}

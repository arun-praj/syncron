import { mediaProvider } from "@syncron/protocol";
import type { z } from "zod";

// Single source of truth for the streaming services Syncron auto-detects.
// Shared by the Home screen's service list, the background script's
// side-panel scoping, and the party-setup detection hook so the three
// never drift out of sync.
export interface StreamingService {
  id: Exclude<z.infer<typeof mediaProvider>, "GENERIC">;
  name: string;
  origin: string;
  href: string;
  icon: string;
}

export const STREAMING_SERVICES: StreamingService[] = [
  {
    id: "YOUTUBE",
    name: "YouTube",
    origin: "https://www.youtube.com",
    href: "https://www.youtube.com",
    icon: "/static/services/youtube.svg",
  },
  {
    id: "SPOTIFY",
    name: "Spotify",
    origin: "https://www.spotify.com",
    href: "https://www.spotify.com",
    icon: "/static/services/spotify.svg",
  },
  {
    id: "NETFLIX",
    name: "Netflix",
    origin: "https://www.netflix.com",
    href: "https://www.netflix.com",
    icon: "/static/services/netflix.svg",
  },
];

export function findStreamingServiceByOrigin(origin: string): StreamingService | undefined {
  return STREAMING_SERVICES.find((service) => service.origin === origin);
}

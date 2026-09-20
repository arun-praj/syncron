


import { serverEvent, type ClientEvent, type ServerEvent } from "@syncron/protocol";

import { WS_BASE_URL } from "@/services/api/client";

export type { ClientEvent, ServerEvent };

// docs/realtime-protocol.md: "Send client.ping at least every 15 seconds;
// 30 seconds without an event closes the socket." Comfortably inside that
// — but browsers throttle setInterval in backgrounded tabs (Chrome's
// "intensive throttling" can clamp a page timer to roughly once a minute
// after the tab's been hidden a while), so this alone can't guarantee the
// 30s budget is met purely from a hidden tab's timer firing on schedule.
// The visibilitychange listener below sends an immediate catch-up ping
// the moment the tab becomes visible again, which is what actually keeps
// a long background stretch from silently timing out the connection.
const PING_INTERVAL_MS = 10000;
// docs/realtime-protocol.md section 7's example progression.
const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 4000];
const MAX_RECONNECT_DELAY_MS = 10000;

export interface PlaybackSocketHandlers {
  onEvent: (event: ServerEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

function requestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// One connection per room, for the lifetime of RoomScreen. Reconnects with
// a fresh ticket on any close that wasn't explicitly requested by close().
export class PlaybackSocket {
  private ws: WebSocket | null = null;
  private sequence = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private closedByCaller = false;
  private initialSyncPending = false;
  private serverClockOffsetMs = 0;
  private hasServerClockOffset = false;
  private hasAccurateServerClock = false;
  private readonly onVisible = () => {
    if (!document.hidden) this.catchUp();
  };

  constructor(
    private readonly roomId: string,
    private readonly getTicket: () => Promise<string>,
    private readonly handlers: PlaybackSocketHandlers,
  ) {}

  connect(): void {
    this.closedByCaller = false;
    document.addEventListener("visibilitychange", this.onVisible);
    void this.open();
  }

  close(): void {
    this.closedByCaller = true;
    document.removeEventListener("visibilitychange", this.onVisible);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    this.ws?.close(1000, "Client closed");
    this.ws = null;
  }

  // Sent immediately when the tab regains visibility, so a backgrounded
  // tab's throttled ping timer doesn't leave the connection looking idle
  // to the server for longer than it actually was, and so a resync
  // catches up on anything missed while hidden.
  private catchUp(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.enqueue("client.ping", { clientTime: Date.now() });
      this.requestSync();
    }
  }

  private async open(): Promise<void> {
    let ticket: string;
    try {
      ticket = await this.getTicket();
    } catch {
      this.scheduleReconnect();
      return;
    }
    if (this.closedByCaller) return;

    const ws = new WebSocket(
      `${WS_BASE_URL}/api/v1/rooms/${this.roomId}/ws?ticket=${encodeURIComponent(ticket)}`,
    );
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.sequence = 0;
      this.reconnectAttempt = 0;
      this.initialSyncPending = true;
      this.serverClockOffsetMs = 0;
      this.hasServerClockOffset = false;
      this.hasAccurateServerClock = false;
      this.startPing();
      this.handlers.onOpen?.();
      this.enqueue("client.ping", { clientTime: Date.now() });
    });

    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const result = serverEvent.safeParse(parsed);
      if (result.success) {
        this.observeServerTime(result.data.serverTime);
        if (result.data.type === "server.pong") {
          this.observeServerPong(result.data.payload.clientTime, result.data.payload.serverTime);
        }
        this.handlers.onEvent(result.data);
      }
    });

    ws.addEventListener("close", () => {
      this.stopPing();
      if (this.ws === ws) this.ws = null;
      this.handlers.onClose?.();
      if (!this.closedByCaller) this.scheduleReconnect();
    });

    ws.addEventListener("error", () => ws.close());
  }

  private scheduleReconnect(): void {
    if (this.closedByCaller || this.reconnectTimer) return;
    const base = Math.min(
      RECONNECT_DELAYS_MS[this.reconnectAttempt] ?? MAX_RECONNECT_DELAY_MS,
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt += 1;
    // Equal jitter: never shorter than half the nominal delay, so a batch
    // of clients disconnected by the same outage don't all reconnect (and
    // re-hit POST /ws-ticket) in the same instant.
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByCaller) void this.open();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.enqueue("client.ping", { clientTime: Date.now() });
      this.requestSync();
    }, PING_INTERVAL_MS);
  }

  private observeServerTime(serverTime: number): void {
    if (this.hasServerClockOffset) return;
    this.serverClockOffsetMs = serverTime - Date.now();
    this.hasServerClockOffset = true;
  }

  private observeServerPong(clientTime: number, serverTime: number): void {
    const receivedAt = Date.now();
    const roundTrip = Math.max(0, receivedAt - clientTime);
    const sample = serverTime - (clientTime + roundTrip / 2);
    this.serverClockOffsetMs = this.hasAccurateServerClock
      ? this.serverClockOffsetMs * 0.8 + sample * 0.2
      : sample;
    this.hasServerClockOffset = true;
    this.hasAccurateServerClock = true;
    if (this.initialSyncPending) {
      this.initialSyncPending = false;
      this.requestSync();
    }
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private enqueue(type: ClientEvent["type"], payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.sequence += 1;
    this.ws.send(
      JSON.stringify({
        type,
        requestId: requestId(),
        sequence: this.sequence,
        sentAt: Date.now(),
        payload,
      }),
    );
  }

  requestSync(): void {
    this.enqueue("playback.sync_request", {});
  }

  serverNow(): number {
    return Date.now() + this.serverClockOffsetMs;
  }

  play(media: { provider: "YOUTUBE"; mediaId: string | null; url: string; position: number }): void {
    this.enqueue("playback.play", media);
  }

  pause(media: { provider: "YOUTUBE"; mediaId: string | null; url: string; position: number }): void {
    this.enqueue("playback.pause", media);
  }

  seek(media: { provider: "YOUTUBE"; mediaId: string | null; url: string; position: number }): void {
    this.enqueue("playback.seek", media);
  }

  rateChange(payload: { position: number; playbackRate: number }): void {
    this.enqueue("playback.rate_change", payload);
  }

  audioChange(payload: { position: number; muted: boolean; volume: number }): void {
    this.enqueue("playback.audio_change", payload);
  }

  mediaChange(payload: {
    provider: "YOUTUBE";
    mediaId: string | null;
    url: string;
    position: number;
    paused: boolean;
    muted: boolean;
    volume: number;
    metadata?: { title?: string };
  }): void {
    this.enqueue("playback.media_change", payload);
  }

  buffering(payload: { buffering: boolean; position: number }): void {
    this.enqueue("playback.buffering", payload);
  }
}

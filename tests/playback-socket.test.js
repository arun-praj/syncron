import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {
    constructor(status) {
      super("ticket failed");
      this.status = status;
    }
  },
}));

vi.mock("@/services/api/client", () => ({
  ApiError: mocks.ApiError,
  WS_BASE_URL: "ws://localhost:8000",
}));

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  readyState = FakeWebSocket.CONNECTING;
  listeners = new Map();
  sent = [];

  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.(event);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  send(data) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "Client closed") {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", { code, reason });
  }
}

const documentStub = {
  hidden: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

async function flush() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

const { PlaybackSocket } = await import("../apps/extension/src/services/playback-socket/client.ts");

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("document", documentStub);
  FakeWebSocket.instances.length = 0;
  documentStub.addEventListener.mockClear();
  documentStub.removeEventListener.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PlaybackSocket terminal and transient failures", () => {
  test("stops without retrying after a terminal ticket failure", async () => {
    const onTerminal = vi.fn();
    const getTicket = vi.fn().mockRejectedValue(new mocks.ApiError(401));
    const socket = new PlaybackSocket("room-1", getTicket, { onEvent: vi.fn(), onTerminal });

    socket.connect();
    await flush();

    expect(getTicket).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith("Your party session is no longer valid.");
    expect(documentStub.removeEventListener).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  test("exits without retrying after a terminal membership close", async () => {
    const onTerminal = vi.fn();
    const getTicket = vi.fn().mockResolvedValue("ticket");
    const socket = new PlaybackSocket("room-1", getTicket, { onEvent: vi.fn(), onTerminal });

    socket.connect();
    await flush();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.close(4003, "Left");
    await flush();

    expect(onTerminal).toHaveBeenCalledWith("You are no longer a member of this party.");
    expect(getTicket).toHaveBeenCalledTimes(1);
  });

  test("retries transient ticket failures and accepts a later socket", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onOpen = vi.fn();
    const getTicket = vi.fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue("ticket");
    const socket = new PlaybackSocket("room-1", getTicket, { onEvent: vi.fn(), onOpen });

    socket.connect();
    await vi.advanceTimersByTimeAsync(125);
    await flush();
    expect(getTicket).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0].open();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("ignores a late open from a socket closed during connection", async () => {
    const onOpen = vi.fn();
    const getTicket = vi.fn().mockResolvedValue("ticket");
    const socket = new PlaybackSocket("room-1", getTicket, { onEvent: vi.fn(), onOpen });

    socket.connect();
    await flush();
    const ws = FakeWebSocket.instances[0];
    socket.close();
    ws.open();

    expect(onOpen).not.toHaveBeenCalled();
  });
});

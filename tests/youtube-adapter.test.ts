import { afterEach, expect, test, vi } from "vitest";
import { YoutubeMediaAdapter } from "../apps/extension/src/media/youtube-adapter.js";

class FakeVideo {
  duration = 120;
  currentTime = 4;
  paused = true;
  playbackRate = 1;
  muted = false;
  volume = 1;
  autoplay = true;
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(name: string, listener: EventListener): void {
    const listeners = this.listeners.get(name) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name: string, listener: EventListener): void {
    this.listeners.get(name)?.delete(listener);
  }

  dispatch(name: string): void {
    for (const listener of this.listeners.get(name) ?? []) listener(new Event(name));
  }

  pause(): void {
    this.paused = true;
  }

  removeAttribute(): void {}

  requestVideoFrameCallback?: never;
}

afterEach(() => vi.unstubAllGlobals());

test("reapplies authoritative audio to a replacement YouTube video element", () => {
  let video = new FakeVideo();
  const liveKitVideo = new FakeVideo();
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: (selector: string) => selector === "#movie_player video" ? video : liveKitVideo,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  adapter.start();
  adapter.applyRemote({
    position: 4,
    paused: true,
    playbackRate: 1,
    muted: true,
    volume: 0,
    updatedAt: Date.now(),
  });
  expect(video).toMatchObject({ muted: true, volume: 0 });
  expect(liveKitVideo).toMatchObject({ muted: false, volume: 1 });

  video = new FakeVideo();
  adapter.start();
  expect(video).toMatchObject({ muted: true, volume: 0 });

  adapter.applyRemote({
    position: 4,
    paused: true,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
  });
  video.volume = 0;
  video.muted = true;
  video.dispatch("volumechange");
  (adapter as unknown as { correctDrift: () => void }).correctDrift();
  expect(video).toMatchObject({ muted: true, volume: 0 });
  adapter.applyRemote({
    position: 4,
    paused: true,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
  }, true);
  expect(video).toMatchObject({ muted: false, volume: 1 });
  adapter.stop();
});

test("projects at the authoritative rate and stops correction inside the hysteresis", () => {
  let now = 1_000;
  const video = new FakeVideo();
  video.paused = false;
  video.currentTime = 9.98;
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  adapter.start();
  adapter.applyRemote({
    position: 10,
    paused: false,
    playbackRate: 1.5,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
    serverNow: Date.now(),
  });
  expect(video.playbackRate).toBeCloseTo(1.54);

  now += 1_000;
  video.currentTime = 11.497;
  (adapter as unknown as { correctDrift: () => void }).correctDrift();
  expect(video.playbackRate).toBe(1.5);
  adapter.stop();
});

test("does not publish the rate-change event caused by a 5% drift correction", () => {
  const video = new FakeVideo();
  video.paused = false;
  video.currentTime = 9.975;
  vi.stubGlobal("performance", { now: () => 1_000 });
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  const events: unknown[] = [];
  adapter.subscribe((event) => events.push(event));
  adapter.start();
  adapter.applyRemote({
    position: 10,
    paused: false,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
    serverNow: Date.now(),
  });
  expect(video.playbackRate).toBe(1.05);
  video.dispatch("ratechange");
  expect(events).toHaveLength(0);
  adapter.stop();
});

test("does not publish a delayed correction rate after a seek resets remote markers", () => {
  const video = new FakeVideo();
  video.paused = false;
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  const events: unknown[] = [];
  adapter.subscribe((event) => events.push(event));
  adapter.start();
  adapter.applyRemote({
    position: 10,
    paused: false,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
    serverNow: Date.now(),
  });
  video.playbackRate = 1.05;
  (adapter as unknown as { remoteEventTypes: Set<string>; remoteRateChangeTarget: number | null }).remoteEventTypes.clear();
  (adapter as unknown as { remoteEventTypes: Set<string>; remoteRateChangeTarget: number | null }).remoteRateChangeTarget = null;
  video.dispatch("ratechange");
  expect(events).toHaveLength(0);
  adapter.stop();
});

test("does not undo a local play before the server acknowledges it", () => {
  const video = new FakeVideo();
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  adapter.start();
  adapter.applyRemote({
    position: 4,
    paused: true,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
  });
  video.paused = false;
  video.dispatch("play");
  video.dispatch("playing");
  expect(video.paused).toBe(false);
  adapter.applyRemote({
    position: 4,
    paused: false,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
  });
  expect(video.paused).toBe(false);
  adapter.stop();
});

test("does not publish transient pause and play events while seeking", () => {
  const video = new FakeVideo();
  video.paused = false;
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  const events: string[] = [];
  adapter.subscribe((event) => {
    if ("snapshot" in event) events.push(event.type);
  });
  adapter.start();
  adapter.applyRemote({
    position: 4,
    paused: false,
    playbackRate: 1,
    muted: false,
    volume: 1,
    updatedAt: Date.now(),
  });
  video.dispatch("seeking");
  video.paused = true;
  video.dispatch("pause");
  video.paused = false;
  video.dispatch("play");
  video.dispatch("seeked");
  expect(events).toEqual(["seek"]);
  adapter.stop();
});

test("members cannot let YouTube autoplay navigate away from the locked media", () => {
  const video = new FakeVideo();
  vi.stubGlobal("location", { href: "https://www.youtube.com/watch?v=video" });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  adapter.setAutoplayAllowed(false);
  adapter.start();
  expect(video.autoplay).toBe(false);
  video.dispatch("ended");
  expect(video.autoplay).toBe(false);
  adapter.stop();
});

test("the host may advance once after the video ends and locks the new media", () => {
  const page = { href: "https://www.youtube.com/watch?v=video" };
  const video = new FakeVideo();
  vi.stubGlobal("location", page);
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    hidden: false,
    querySelector: () => video,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const adapter = new YoutubeMediaAdapter();
  adapter.setAutoplayAllowed(true);
  adapter.start();
  adapter.lockToCurrentMedia();
  video.dispatch("ended");
  page.href = "https://www.youtube.com/watch?v=next-video";
  (adapter as unknown as { handleNavigation: () => void }).handleNavigation();
  expect((adapter as unknown as { isLockedMedia: () => boolean }).isLockedMedia()).toBe(true);
  adapter.stop();
});

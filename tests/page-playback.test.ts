import { afterEach, expect, test, vi } from "vitest";
import { readPagePlaybackSnapshot, resetPagePlaybackToStart } from "../apps/extension/src/lib/page-playback.js";

class FakeVideo {
  duration = 120;
  currentTime = 42;
  paused = false;
  playbackRate = 1;
  muted = false;
  volume = 1;

  pause(): void {
    this.paused = true;
  }
}

afterEach(() => vi.unstubAllGlobals());

test("reads the YouTube player instead of another video element", () => {
  const mainVideo = new FakeVideo();
  const otherVideo = new FakeVideo();
  vi.stubGlobal("document", {
    title: "Video - YouTube",
    querySelector: (selector: string) => selector === "#movie_player video" ? mainVideo : otherVideo,
  });

  expect(readPagePlaybackSnapshot()?.currentTime).toBe(42);
});

test("resets the YouTube player to the beginning and pauses it", () => {
  const video = new FakeVideo();
  vi.stubGlobal("document", { querySelector: () => video });

  resetPagePlaybackToStart();

  expect(video).toMatchObject({ currentTime: 0, paused: true });
});

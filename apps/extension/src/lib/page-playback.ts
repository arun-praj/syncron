import type { PlaybackSnapshot } from "@/lib/playback-messages";

export function readPagePlaybackSnapshot(): PlaybackSnapshot | null {
  const video = document.querySelector("video");
  if (!video || Number.isNaN(video.duration)) return null;

  return {
    title: document.title.replace(/ - YouTube$/, ""),
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
  };
}

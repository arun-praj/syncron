import type { PlaybackSnapshot } from "./playback-messages.js";

function youtubeVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("#movie_player video")
    ?? document.querySelector<HTMLVideoElement>("video.html5-main-video")
    ?? document.querySelector<HTMLVideoElement>("video");
}

export function readPagePlaybackSnapshot(): PlaybackSnapshot | null {
  const video = youtubeVideo();
  if (!video || Number.isNaN(video.duration)) return null;

  return {
    title: document.title.replace(/ - YouTube$/, ""),
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    playbackRate: video.playbackRate,
    muted: video.muted,
    volume: video.volume,
  };
}

export function resetPagePlaybackToStart(): void {
  const video = youtubeVideo();
  if (!video || Number.isNaN(video.duration)) return;
  video.pause();
  video.currentTime = 0;
}

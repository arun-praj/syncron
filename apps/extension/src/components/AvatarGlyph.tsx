import { browser, type PublicPath } from "wxt/browser";

import { avatarId } from "../../../../packages/protocol/src/index.js";

// Bundled Tapback-Memoji snapshots. IDs are the source-of-truth
// @syncron/protocol avatarId enum ("1"-"30").
export const AVATAR_IDS = avatarId.options;

// Resolved via runtime.getURL (not a plain relative path) since this can
// render inside the YouTube in-page sidebar, where a relative src would
// resolve against youtube.com's origin instead of the extension's.
export function avatarGlyphSrc(id: string): string {
  return browser.runtime.getURL(`/static/avatars/${id}.webp` as PublicPath);
}

export function AvatarGlyph({
  avatarId: id,
  className = "",
}: {
  avatarId: string;
  className?: string;
}) {
  return (
    <img
      src={avatarGlyphSrc(id)}
      alt=""
      aria-hidden="true"
      className={`rounded-full object-cover ${className}`}
    />
  );
}

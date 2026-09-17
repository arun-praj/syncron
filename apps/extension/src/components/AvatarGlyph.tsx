import { avatarId } from "../../../../packages/protocol/src/index.js";

// Bundled Tapback-Memoji snapshots. IDs are the source-of-truth
// @syncron/protocol avatarId enum ("1"-"30").
export const AVATAR_IDS: readonly string[] = avatarId.options;

export function AvatarGlyph({
  avatarId: id,
  className = "",
}: {
  avatarId: string;
  className?: string;
}) {
  return (
    <img
      src={`/static/avatars/${id}.webp`}
      alt=""
      aria-hidden="true"
      className={`rounded-full object-cover ${className}`}
    />
  );
}

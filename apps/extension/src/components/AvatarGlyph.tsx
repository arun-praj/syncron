import { avatarId } from "../../../../packages/protocol/src/index.js";

// Bundled, deterministic placeholder avatars — no network fetch, ever (see
// docs/frontend-requirements.md: 30 curated avatars shipped in the bundle).
// IDs are the source-of-truth @syncron/protocol avatarId enum ("1"-"30"),
// not a locally re-declared range.
export const AVATAR_IDS: readonly string[] = avatarId.options;

const MOUTHS = [
  <path d="M8 15 Q12 19 16 15" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" />,
  <path d="M8.5 16 H15.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />,
  <path d="M8.5 15.5 Q12 17 15 14.5" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" />,
  <circle cx={12} cy={16} r={2} stroke="#fff" strokeWidth={1.6} fill="none" />,
];

function colorForAvatarId(id: string): string {
  const index = Number(id) - 1;
  return `hsl(${Math.round((index * 360) / AVATAR_IDS.length)}, 70%, 65%)`;
}

export function AvatarGlyph({
  avatarId: id,
  className = "",
}: {
  avatarId: string;
  className?: string;
}) {
  const index = Number(id) - 1;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`rounded-full ${className}`}
      style={{ background: colorForAvatarId(id) }}>
      <circle cx={8} cy={10} r={1.6} fill="#fff" />
      <circle cx={16} cy={10} r={1.6} fill="#fff" />
      {MOUTHS[index % MOUTHS.length]}
    </svg>
  );
}

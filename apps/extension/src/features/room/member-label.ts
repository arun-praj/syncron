export interface MemberLabelSource {
  id: string;
  name?: string;
  username?: string;
}

export function formatMemberLabel(member: MemberLabelSource | null | undefined, selfUserId?: string): string {
  if (!member) return "Someone";
  if (member.id === selfUserId) return "You";
  const username = member.username?.trim().replace(/^@+/, "");
  return username ? `@${username}` : member.name?.trim() || "Someone";
}

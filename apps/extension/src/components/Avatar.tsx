interface AvatarProps {
  name: string;
  initials: string;
  color: string;
  size?: number;
}

export function Avatar({ name, initials, color, size = 28 }: AvatarProps) {
  return (
    <div
      title={name}
      className="flex items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, backgroundColor: color }}>
      {initials}
    </div>
  );
}

export function AvatarStack({ users }: { users: AvatarProps[] }) {
  return (
    <div className="flex -space-x-2">
      {users.map((u) => (
        <Avatar key={u.name} {...u} />
      ))}
    </div>
  );
}

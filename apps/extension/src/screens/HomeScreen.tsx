import { AvatarGlyph } from "@/src/components/AvatarGlyph";
import { Logo } from "@/src/components/Logo";
import { useAuthStore } from "@/src/stores/auth-store";

const SERVICES = [
  { name: "YouTube", href: "https://www.youtube.com", icon: "/static/services/youtube.svg" },
  { name: "Spotify", href: "https://www.spotify.com", icon: "/static/services/spotify.svg" },
  { name: "Netflix", href: "https://www.netflix.com", icon: "/static/services/netflix.svg" },
] as const;

export default function HomeScreen({
  onOpenProfile,
  onOpenService,
}: {
  onOpenProfile: () => void;
  onOpenService?: (href: string) => void;
}) {
  const { user } = useAuthStore();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
        <Logo />
        <button
          type="button"
          aria-label="Open profile"
          onClick={onOpenProfile}
          className="group flex cursor-pointer items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 transition-colors hover:bg-neutral-50">
          <span className="text-[12.5px] font-medium text-ink-label transition-colors group-hover:text-ink-primary group-hover:underline">
            @{user?.username ?? ""}
          </span>
          {user?.avatarId && <AvatarGlyph avatarId={user.avatarId} className="h-[26px] w-[26px]" />}
        </button>
      </div>

      <p className="px-[18px] pb-1.5 pt-4 text-label text-ink-secondary">
        Start on a streaming site below, then reopen Syncron to sync up.
      </p>

      <div className="flex-1 px-[18px] pb-5 pt-2.5">
        <div className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-placeholder">
          Streaming services
        </div>
        <div className="flex flex-col gap-2">
          {SERVICES.map((service) => (
            <a
              key={service.name}
              href={service.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!onOpenService) return;
                event.preventDefault();
                onOpenService(service.href);
              }}
              className="flex items-center gap-3.5 rounded-xl border border-border p-3.5 transition-colors hover:border-border-input hover:bg-neutral-50">
              <img src={service.icon} alt={service.name} className="h-10 w-10 flex-shrink-0 rounded-[10px]" />
              <span className="flex-1 text-[14.5px] font-semibold text-ink-primary">
                {service.name}
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-ink-placeholder">
                <path
                  d="M7 17L17 7M17 7H9M17 7V15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ))}
          <div className="flex items-center gap-3.5 rounded-xl border border-border p-3.5">
            <img
              src="/static/services/generic.svg"
              alt="Generic site"
              className="h-10 w-10 flex-shrink-0 rounded-[10px]"
            />
            <span className="flex-1 text-[14.5px] font-semibold text-ink-primary">
              Any other site
            </span>
            <span className="flex-shrink-0 rounded-full bg-neutral-100 px-2 py-[3px] text-[10.5px] font-medium text-ink-placeholder">
              Video/audio pages
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

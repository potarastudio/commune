import { ChevronDown } from "lucide-react";
import type { Channel } from "@/lib/queries/channels";
import type { Profile } from "@/lib/queries/profile";
import { ChannelLink } from "./channel-link";
import { UserMenu } from "./user-menu";

export function Sidebar({ profile, channels }: { profile: Profile; channels: Channel[] }) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 items-center gap-1.5 border-b border-sidebar-border px-4">
        <span className="text-[15px] font-semibold tracking-tight">Potara Studio</span>
        <ChevronDown className="size-3.5 text-sidebar-muted" aria-hidden="true" />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Channels">
        <p className="px-2 pb-1 text-[12px] font-medium uppercase tracking-[0.08em] text-sidebar-muted">Channels</p>
        <ul>
          {channels.map((c) => (
            <li key={c.id}>
              <ChannelLink channel={c} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-1.5 py-1.5">
        <UserMenu profile={profile} />
      </div>
    </aside>
  );
}

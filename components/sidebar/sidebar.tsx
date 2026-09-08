import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Channel } from "@/lib/queries/channels";
import type { Profile } from "@/lib/queries/profile";
import { ChannelLink } from "./channel-link";
import { SignOutButton } from "./sign-out-button";

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

      <div className="flex items-center gap-2.5 border-t border-sidebar-border px-3 py-2.5">
        <span className="relative">
          <Avatar className="size-8 rounded-md">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="rounded-md bg-primary text-[12px] font-semibold text-primary-foreground">
              {profile.display_name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar bg-online"
            aria-label="Online"
          />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">{profile.display_name}</p>
          <p className="truncate text-[12px] text-sidebar-muted">@{profile.handle}</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}

import { ChevronDown } from "lucide-react";
import type { JoinedChannel } from "@/lib/queries/channels";
import type { ConversationSummary } from "@/lib/queries/conversations";
import type { Profile } from "@/lib/queries/profile";
import type { UnreadMap } from "@/lib/utils/unreads";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function Sidebar({
  profile,
  channels,
  conversations,
  unreads,
}: {
  profile: Profile;
  channels: JoinedChannel[];
  conversations: ConversationSummary[];
  unreads: UnreadMap;
}) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 items-center gap-1.5 border-b border-sidebar-border px-4">
        <span className="text-[15px] font-semibold tracking-tight">Potara Studio</span>
        <ChevronDown className="size-3.5 text-sidebar-muted" aria-hidden="true" />
      </div>

      <SidebarNav me={profile} channels={channels} conversations={conversations} initialUnreads={unreads} />

      <div className="border-t border-sidebar-border px-1.5 py-1.5">
        <UserMenu profile={profile} />
      </div>
    </aside>
  );
}

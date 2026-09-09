import { ChevronDown, Pencil } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { JoinedChannel } from "@/lib/queries/channels";
import type { ConversationSummary } from "@/lib/queries/conversations";
import type { Profile } from "@/lib/queries/profile";
import type { UnreadMap } from "@/lib/utils/unreads";
import { SidebarNav } from "./sidebar-nav";
import { SidebarSearchButton } from "./sidebar-search-button";

export { WorkspaceRail } from "./sidebar-nav";

/**
 * The 272px channel column. Unlike the rail beside it, this one is themed:
 * light grey in light mode, near-black in dark.
 *
 * Below 900px it steps aside for the conversation, as the design's tablet state
 * does; the rail stays put and keeps every destination reachable.
 */
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
    <aside className="flex w-[272px] shrink-0 flex-col border-r border-border bg-bg-col max-[900px]:hidden">
      <div className="flex h-[56px] shrink-0 items-center gap-[6px] pr-[10px] pl-[16px]">
        <span className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">Potara Studio</span>
        <ChevronDown className="size-[14px] shrink-0 text-muted-foreground" aria-hidden="true" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dm/new"
              aria-label="New message"
              className="ml-auto grid size-[28px] shrink-0 place-items-center rounded-md text-fg-600 transition-colors hover:bg-bg-avatar hover:text-ink"
            >
              <Pencil className="size-[16px]" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">New message</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-[12px] pb-[12px]">
        <SidebarSearchButton />
      </div>

      <SidebarNav me={profile} channels={channels} conversations={conversations} initialUnreads={unreads} />
    </aside>
  );
}

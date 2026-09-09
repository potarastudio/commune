import { Archive } from "lucide-react";
import type { ChannelMember, ChannelRow } from "@/lib/queries/channel";
import { ChannelDetails } from "./channel-details";
import { MembersButton } from "./panel-buttons";

/**
 * Channel header (§6): 56px, hairline bottom, on the main surface. Title →
 * divider → topic on the left; member stack → divider → pins → Huddle on the
 * right, with Huddle as the one filled accent button on the screen.
 *
 * The header lives inside the channel column, so an open thread or details
 * panel narrows it. It sheds in a designed order rather than letting the
 * actions slide under the panel: topic first, then the member stack (whose
 * job the open panel is already doing). Both come back when the panel closes.
 */
export function ChannelHeader({
  channel,
  members,
  huddle,
  pins,
}: {
  channel: ChannelRow;
  members: ChannelMember[];
  huddle?: React.ReactNode;
  pins?: React.ReactNode;
}) {
  return (
    <header className="@container/hdr flex h-14 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-bg-main px-5">
      <ChannelDetails channel={channel} />
      {channel.is_archived && (
        <span className="flex shrink-0 items-center gap-1 rounded-sm border border-border-strong bg-bg-chip px-1.5 py-px text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <Archive className="size-[11px]" aria-hidden="true" /> Archived
        </span>
      )}
      {channel.topic && (
        <>
          <span className="hidden h-5 w-px shrink-0 bg-border @[520px]/hdr:block" aria-hidden="true" />
          <p className="hidden min-w-0 truncate text-[13px] text-fg-600 @[520px]/hdr:block">{channel.topic}</p>
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2.5">
        <span className="hidden items-center gap-2.5 @[400px]/hdr:flex">
          <MembersButton count={members.length} people={members} />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        </span>
        {pins}
        {huddle}
      </span>
    </header>
  );
}

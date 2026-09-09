import { Archive } from "lucide-react";
import type { ChannelMember, ChannelRow } from "@/lib/queries/channel";
import { ChannelDetails } from "./channel-details";
import { MembersButton } from "./panel-buttons";

/**
 * Channel header (§6): 56px, hairline bottom, on the main surface. Title →
 * divider → topic on the left; member stack → divider → pins → Huddle on the
 * right, with Huddle as the one filled accent button on the screen.
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-main px-5">
      <ChannelDetails channel={channel} />
      {channel.is_archived && (
        <span className="flex shrink-0 items-center gap-1 rounded-sm border border-border-strong bg-bg-chip px-1.5 py-px text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <Archive className="size-[11px]" aria-hidden="true" /> Archived
        </span>
      )}
      {channel.topic && (
        <>
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <p className="min-w-0 truncate text-[13px] text-fg-600">{channel.topic}</p>
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2.5">
        <MembersButton count={members.length} people={members} />
        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        {pins}
        {huddle}
      </span>
    </header>
  );
}

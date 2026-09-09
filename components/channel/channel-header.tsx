import { Archive, Users } from "lucide-react";
import type { ChannelMember, ChannelRow } from "@/lib/queries/channel";
import type { NotificationLevel } from "@/lib/queries/channels";
import { ChannelDetails } from "./channel-details";

export function ChannelHeader({
  channel,
  members,
  isMember,
  isAdmin,
  notificationLevel,
  huddle,
  pins,
}: {
  channel: ChannelRow;
  members: ChannelMember[];
  isMember: boolean;
  isAdmin: boolean;
  notificationLevel: NotificationLevel | null;
  huddle?: React.ReactNode;
  pins?: React.ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3.5">
      <ChannelDetails channel={channel} members={members} isMember={isMember} isAdmin={isAdmin} notificationLevel={notificationLevel} />
      {channel.is_archived && (
        <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <Archive className="size-3" aria-hidden="true" /> Archived
        </span>
      )}
      {channel.topic && (
        <>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <p className="min-w-0 truncate text-[13px] text-muted-foreground">{channel.topic}</p>
        </>
      )}
      <span className="ml-auto flex items-center gap-2">
        {huddle}
        {pins}
        <span className="mr-1.5 flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          {members.length}
        </span>
      </span>
    </header>
  );
}

import { Hash, Lock, Users } from "lucide-react";
import type { ChannelRow } from "@/lib/queries/channel";

export function ChannelHeader({ channel, memberCount }: { channel: ChannelRow; memberCount: number }) {
  const Icon = channel.is_private ? Lock : Hash;
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
      <h1 className="flex items-center gap-1 text-[15px] font-semibold tracking-tight">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {channel.name}
      </h1>
      {channel.topic && (
        <>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <p className="min-w-0 truncate text-[13px] text-muted-foreground">{channel.topic}</p>
        </>
      )}
      <span className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground">
        <Users className="size-3.5" aria-hidden="true" />
        {memberCount}
      </span>
    </header>
  );
}

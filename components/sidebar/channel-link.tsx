"use client";

import { Hash, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Channel } from "@/lib/queries/channels";

export function ChannelLink({ channel }: { channel: Channel }) {
  const pathname = usePathname();
  const active = pathname === `/channel/${channel.id}`;
  const Icon = channel.is_private ? Lock : Hash;
  return (
    <Link
      href={`/channel/${channel.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex h-7 items-center gap-2 rounded-md px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${
        active
          ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
          : "text-sidebar-foreground/85 hover:bg-sidebar-hover hover:text-sidebar-foreground"
      }`}
    >
      <Icon className={`size-3.5 shrink-0 ${active ? "text-sidebar-active-foreground/80" : "text-sidebar-muted"}`} aria-hidden="true" />
      <span className="truncate">{channel.name}</span>
    </Link>
  );
}

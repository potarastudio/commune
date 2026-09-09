"use client";

import { ChevronDown, Hash, Lock } from "lucide-react";
import type { ChannelRow } from "@/lib/queries/channel";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** Header title: click to open the details panel (About tab). */
export function ChannelDetails({ channel }: { channel: ChannelRow }) {
  const { openPanel, showPanel, closePanel } = useThreadNav();
  const open = openPanel === "details";
  const Icon = channel.is_private ? Lock : Hash;
  return (
    <button
      type="button"
      onClick={() => (open ? closePanel() : showPanel("details", "about"))}
      aria-pressed={open}
      aria-label={`${channel.name} details`}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[15px] font-semibold tracking-tight hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      {channel.name}
      <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

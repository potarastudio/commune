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
      className={`-ml-1.5 flex shrink-0 items-center gap-[7px] rounded-md px-1.5 py-[5px] hover:bg-bg-subtle ${open ? "bg-bg-subtle" : ""}`}
    >
      <Icon className="size-[15px] shrink-0 text-tertiary" aria-hidden="true" />
      <span className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{channel.name}</span>
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

"use client";

import { Pin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Container, Message } from "@/lib/queries/messages";
import { usePins } from "@/lib/queries/use-messages";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** Header chip: pin count for this container; toggles the pinned panel. */
export function PinsButton({ container, initialPins }: { container: Container; initialPins: Message[] }) {
  const { openPanel, showPanel, closePanel } = useThreadNav();
  const { data } = usePins(container, initialPins);
  const count = (data ?? []).filter((m) => m.is_pinned && !m.deleted_at).length;
  const open = openPanel === "pins";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => (open ? closePanel() : showPanel("pins"))}
          aria-pressed={open}
          aria-label={count === 1 ? "1 pinned message" : `${count} pinned messages`}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-[9px] text-[13px] font-medium shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            open
              ? "border-accent-surface-border bg-accent-surface text-accent-foreground hover:border-accent-border"
              : "border-border-strong bg-bg-card text-fg-400 hover:border-border-hover hover:bg-bg-card-hover"
          }`}
        >
          <Pin className={`size-[15px] ${open ? "" : "text-fg-600"}`} aria-hidden="true" />
          <span className="tabular-nums">{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{open ? "Hide pinned messages" : "Pinned messages"}</TooltipContent>
    </Tooltip>
  );
}

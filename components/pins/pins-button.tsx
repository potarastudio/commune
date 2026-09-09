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
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] focus-visible:outline-2 focus-visible:outline-ring ${
            open ? "border-primary/40 bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Pin className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{open ? "Hide pinned messages" : "Pinned messages"}</TooltipContent>
    </Tooltip>
  );
}

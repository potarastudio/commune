"use client";

import { Info, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useThreadNav, type PanelTab } from "@/lib/utils/use-thread-nav";

const chip =
  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] focus-visible:outline-2 focus-visible:outline-ring";
const idle = "border-border text-muted-foreground hover:bg-muted hover:text-foreground";
const active = "border-primary/40 bg-accent text-accent-foreground";

function useTab(tab: PanelTab) {
  const { openPanel, panelTab, showPanel, closePanel } = useThreadNav();
  const on = openPanel === "details" && panelTab === tab;
  return { on, toggle: () => (on ? closePanel() : showPanel("details", tab)) };
}

/** Header chip with the member count; opens the Members tab. */
export function MembersButton({ count }: { count: number }) {
  const { on, toggle } = useTab("members");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={toggle} aria-pressed={on} aria-label={`${count} ${count === 1 ? "member" : "members"}`} className={`${chip} ${on ? active : idle}`}>
          <Users className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{on ? "Hide members" : "Members"}</TooltipContent>
    </Tooltip>
  );
}

/** Icon-only chip for DMs, where there is no channel name to click. */
export function DetailsButton() {
  const { on, toggle } = useTab("files");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={toggle} aria-pressed={on} aria-label="Conversation details" className={`${chip} ${on ? active : idle}`}>
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{on ? "Hide details" : "Details"}</TooltipContent>
    </Tooltip>
  );
}

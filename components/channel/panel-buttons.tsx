"use client";

import { Info, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useThreadNav, type PanelTab } from "@/lib/utils/use-thread-nav";

/** Toolbar chip: 32px, card surface, hairline border — the header's quiet button. */
const chip =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-[9px] text-[13px] font-medium shadow-xs transition-colors";
const idle = "border-border-strong bg-bg-card text-fg-400 hover:border-border-hover hover:bg-bg-card-hover";
const active = "border-accent-surface-border bg-accent-surface text-accent-foreground";

export type StackPerson = { id: string; display_name: string; avatar_url: string | null };

function useTab(tab: PanelTab) {
  const { openPanel, panelTab, showPanel, closePanel } = useThreadNav();
  const on = openPanel === "details" && panelTab === tab;
  return { on, toggle: () => (on ? closePanel() : showPanel("details", tab)) };
}

/**
 * Header member count. With people it renders the design's ghost stack of 26px
 * round avatars, each ringed in the header surface and overlapping by 7px.
 * Without them — the group-DM header — it falls back to the bordered 32px chip
 * every other right-slot button in that header uses.
 */
export function MembersButton({ count, people = [] }: { count: number; people?: StackPerson[] }) {
  const { on, toggle } = useTab("members");
  const shown = people.slice(0, 3);
  const label = `${count} ${count === 1 ? "member" : "members"}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {shown.length > 0 ? (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={on}
            aria-label={label}
            className={`flex h-[34px] shrink-0 items-center gap-2 rounded-md py-1 pl-1 pr-2 text-[13px] font-medium transition-colors ${
              on ? "bg-bg-subtle text-ink" : "text-fg-600 hover:bg-bg-subtle hover:text-ink"
            }`}
          >
            <span className="flex shrink-0" aria-hidden="true">
              {shown.map((p, i) => (
                <Avatar key={p.id} size="sm" className={`ring-2 ring-bg-main ${i > 0 ? "-ml-[7px]" : ""}`}>
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback>{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
            </span>
            <span className="tabular-nums">{count}</span>
          </button>
        ) : (
          <button type="button" onClick={toggle} aria-pressed={on} aria-label={label} className={`${chip} ${on ? active : idle}`}>
            <Users className={`size-[15px] ${on ? "" : "text-fg-600"}`} aria-hidden="true" />
            <span className="tabular-nums">{count}</span>
          </button>
        )}
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
          <Info className={`size-[15px] ${on ? "" : "text-fg-600"}`} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{on ? "Hide details" : "Details"}</TooltipContent>
    </Tooltip>
  );
}

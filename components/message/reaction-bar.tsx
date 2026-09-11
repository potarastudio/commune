"use client";

import { SmilePlus } from "lucide-react";
import { useProfileMap } from "@/lib/queries/profiles";
import { useHydrated } from "@/lib/utils/use-hydrated";
import type { Reaction } from "@/lib/queries/messages";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Emoji } from "@/components/emoji/emoji";
import { QuickReactionPicker } from "./quick-reaction-picker";

/** Grouped reaction chips: 28px tall, 8px radius. Mine take the accent surface. */
export function ReactionBar({
  reactions,
  meId,
  onToggle,
}: {
  reactions: Reaction[];
  meId: string;
  onToggle: (emoji: string, active: boolean) => void;
}) {
  const profiles = useProfileMap();
  // Names come from a browser-only query, so the server can only say "Someone".
  // If the names land before this part of the page hydrates, using them at
  // once would make the chip's label differ from the server's; wait a frame.
  const hydrated = useHydrated();
  if (reactions.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const r of reactions) groups.set(r.emoji, [...(groups.get(r.emoji) ?? []), r.user_id]);

  const nameOf = (id: string) => (id === meId ? "You" : ((hydrated && profiles.get(id)?.display_name) || "Someone"));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {[...groups.entries()].map(([emoji, users]) => {
        const active = users.includes(meId);
        const names = users.map(nameOf);
        const who =
          names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggle(emoji, active)}
                aria-pressed={active}
                aria-label={`${emoji} ${users.length}, ${who} reacted`}
                className={`flex h-7 items-center gap-1.5 rounded-md border px-[9px] text-[12.5px] tabular-nums transition-colors ${
                  active
                    ? "border-accent-surface-border bg-accent-surface font-semibold text-accent-foreground"
                    : "border-border-strong bg-bg-card font-medium text-fg-400 hover:border-border-hover hover:bg-bg-card-hover"
                }`}
              >
                <span aria-hidden="true" className="text-[13px] leading-none">
                  <Emoji value={emoji} />
                </span>
                {users.length}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-center">
              {who} reacted with <Emoji value={emoji} />
            </TooltipContent>
          </Tooltip>
        );
      })}
      <QuickReactionPicker onPick={(emoji) => onToggle(emoji, reactions.some((r) => r.emoji === emoji && r.user_id === meId))}>
        <button
          type="button"
          aria-label="Add reaction"
          className="grid h-7 w-8 place-items-center rounded-md border border-border-strong bg-bg-card text-muted-foreground hover:bg-bg-card-hover hover:text-fg-400"
        >
          <SmilePlus className="size-3.5" aria-hidden="true" />
        </button>
      </QuickReactionPicker>
    </div>
  );
}

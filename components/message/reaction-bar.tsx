"use client";

import { SmilePlus } from "lucide-react";
import { useProfileMap } from "@/lib/queries/profiles";
import type { Reaction } from "@/lib/queries/messages";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickReactionPicker } from "./quick-reaction-picker";

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
  if (reactions.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const r of reactions) groups.set(r.emoji, [...(groups.get(r.emoji) ?? []), r.user_id]);

  const nameOf = (id: string) => (id === meId ? "You" : (profiles.get(id)?.display_name ?? "Someone"));

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
                className={`flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] tabular-nums transition-colors ${
                  active
                    ? "border-primary/50 bg-accent text-accent-foreground"
                    : "border-border bg-background text-foreground/80 hover:border-foreground/30"
                }`}
              >
                <span aria-hidden="true">{emoji}</span>
                <span className="font-medium">{users.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-center">
              {who} reacted with {emoji}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <QuickReactionPicker onPick={(emoji) => onToggle(emoji, reactions.some((r) => r.emoji === emoji && r.user_id === meId))}>
        <button
          type="button"
          aria-label="Add reaction"
          className="grid h-6 w-7 place-items-center rounded-full border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          <SmilePlus className="size-3.5" aria-hidden="true" />
        </button>
      </QuickReactionPicker>
    </div>
  );
}

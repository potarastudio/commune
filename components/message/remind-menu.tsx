"use client";

import { AlarmClock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createReminderAction } from "@/lib/actions/scheduling";
import { useProfileMap } from "@/lib/queries/profiles";
import { useSessionStore } from "@/lib/store/session";
import { describeWhen, fromLocalInput, reminderPresets } from "@/lib/utils/schedule";

/** "Remind me about this" in the hover bar: presets plus a custom time (§5 Phase 3). */
export function RemindMenu({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [pending, startTransition] = useTransition();
  const meId = useSessionStore((s) => s.meId);
  const timezone = useProfileMap().get(meId ?? "")?.timezone ?? "Asia/Jakarta";

  const set = (at: Date) =>
    startTransition(async () => {
      const result = await createReminderAction({ messageId, remindAt: at.toISOString() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reminder set for ${describeWhen(at, timezone)}`, { description: "You'll get a note in your own DM, and a push if they're on." });
      setOpen(false);
      setCustom("");
    });

  const presets = open ? reminderPresets(new Date(), timezone) : [];
  const customAt = custom ? fromLocalInput(custom, timezone) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Remind me about this"
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <AlarmClock className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Remind me</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-1.5">
        <p className="px-2 pb-1 pt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Remind me</p>
        <ul>
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => set(p.at)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span>{p.label}</span>
                {/* Relative presets get the clock time; the dated ones already say when. */}
                {/^\d+[mh]$/.test(p.id) && <span className="text-[12px] tabular-nums text-muted-foreground">{describeWhen(p.at, timezone).replace(/^Today at /, "")}</span>}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-1 flex items-center gap-1.5 border-t border-border px-1 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (customAt) set(customAt);
          }}
        >
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom time"
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          <Button type="submit" size="sm" disabled={pending || !customAt || customAt.getTime() < Date.now() + 60_000}>
            Set
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

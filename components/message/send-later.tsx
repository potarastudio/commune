"use client";

import { CalendarClock, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cancelScheduledAction } from "@/lib/actions/scheduling";
import type { Container } from "@/lib/queries/messages";
import { useProfileMap } from "@/lib/queries/profiles";
import { useScheduled } from "@/lib/queries/use-scheduling";
import { useSessionStore } from "@/lib/store/session";
import { describeWhen, fromLocalInput, sendLaterPresets } from "@/lib/utils/schedule";

function useTimezone() {
  const meId = useSessionStore((s) => s.meId);
  return useProfileMap().get(meId ?? "")?.timezone ?? "Asia/Jakarta";
}

/** Composer toolbar: pick when the draft should go out (§5 Phase 3). */
export function SendLaterMenu({ disabled, onPick }: { disabled: boolean; onPick: (at: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const timezone = useTimezone();
  const presets = open ? sendLaterPresets(new Date(), timezone) : [];
  const customAt = custom ? fromLocalInput(custom, timezone) : null;
  const pick = (at: Date) => {
    setOpen(false);
    setCustom("");
    onPick(at);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Send later"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
            >
              <CalendarClock className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{disabled ? "Write something to schedule it" : "Send later"}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" className="w-64 p-1.5">
        <p className="px-2 pb-1 pt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Send later</p>
        <ul>
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p.at)}
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
            if (customAt) pick(customAt);
          }}
        >
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom time"
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          <Button type="submit" size="sm" disabled={!customAt || customAt.getTime() < Date.now() + 60_000}>
            Schedule
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Above the composer: what I've queued for this place, with cancel. Hidden when empty. */
export function ScheduledNotice({ container }: { container: Container }) {
  const { data, refetch } = useScheduled(container);
  const timezone = useTimezone();
  const [pending, startTransition] = useTransition();
  const items = data ?? [];
  if (items.length === 0) return null;

  const cancel = (id: string) =>
    startTransition(async () => {
      const result = await cancelScheduledAction({ id });
      if (!result.ok) toast.error(result.error);
      else toast.success("Scheduled message cancelled");
      void refetch();
    });

  return (
    <div className="mb-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-[12px]" aria-label="Scheduled messages">
      <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        {items.length === 1 ? "1 message scheduled" : `${items.length} messages scheduled`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="shrink-0 tabular-nums text-foreground">{describeWhen(m.send_at, timezone)}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.content_text}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => cancel(m.id)}
              aria-label={`Cancel scheduled message: ${m.content_text.slice(0, 40)}`}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

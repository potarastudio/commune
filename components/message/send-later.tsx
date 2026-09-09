"use client";

import { CalendarClock, Clock, X } from "lucide-react";
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

/** The design splits each row into a label and a tabular time. */
function splitPreset(label: string, at: Date, timezone: string) {
  const [head, ...rest] = label.split(" at ");
  if (rest.length) return { head, time: rest.join(" at ") };
  return { head: label, time: describeWhen(at, timezone).replace(/^Today at /, "") };
}

/** Composer toolbar: pick when the draft should go out (§5 Phase 3). */
export function SendLaterMenu({ disabled, onPick }: { disabled: boolean; onPick: (at: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const timezone = useTimezone();
  const presets = open ? sendLaterPresets(new Date(), timezone) : [];
  const customAt = custom ? fromLocalInput(custom, timezone) : null;
  const pick = (at: Date) => {
    setOpen(false);
    setCustom("");
    setCustomOpen(false);
    onPick(at);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCustomOpen(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Send later"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              className={`grid size-[30px] place-items-center rounded-[7px] border transition-colors disabled:opacity-40 ${
                open
                  ? "border-accent-surface-border bg-accent-surface text-accent-foreground"
                  : "border-transparent text-fg-600 hover:bg-bg-subtle hover:text-ink"
              }`}
            >
              <Clock className="size-[15px]" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{disabled ? "Write something to schedule it" : "Send later"}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-[300px] overflow-hidden rounded-xl border-border bg-bg-card p-0 shadow-lg">
        <p className="border-b border-border-subtle px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Send later
        </p>
        <div role="listbox" aria-label="Send later">
          {presets.map((p) => {
            const { head, time } = splitPreset(p.label, p.at, timezone);
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(p.at)}
                className="flex w-full items-center gap-2.5 px-3 py-[9px] text-left transition-colors hover:bg-bg-subtle"
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{head}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{time}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border-subtle p-1.5">
          {customOpen ? (
            <form
              className="flex items-center gap-1.5"
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
                autoFocus
                className="field-focus h-[34px] min-w-0 flex-1 rounded-md border border-border-input bg-bg-card px-2 text-[12.5px] text-ink outline-none transition-[border-color,box-shadow]"
              />
              <Button type="submit" size="sm" disabled={!customAt || customAt.getTime() < Date.now() + 60_000}>
                Schedule
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="flex w-full items-center gap-2 rounded-[7px] p-2 text-[13px] font-semibold text-ink transition-colors hover:bg-bg-subtle"
            >
              <Clock className="size-[14px] text-fg-600" aria-hidden="true" />
              Pick a date and time
            </button>
          )}
        </div>
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
    <div className="mb-2 rounded-lg border border-border bg-bg-subtle px-3 py-2.5" aria-label="Scheduled messages">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        <CalendarClock className="size-[13px]" aria-hidden="true" />
        {items.length === 1 ? "1 message scheduled" : `${items.length} messages scheduled`}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink">{describeWhen(m.send_at, timezone)}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-600">{m.content_text}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => cancel(m.id)}
              aria-label={`Cancel scheduled message: ${m.content_text.slice(0, 40)}`}
              className="grid size-[26px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-card hover:text-danger"
            >
              <X className="size-[14px]" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

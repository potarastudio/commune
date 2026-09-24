"use client";

import { useState } from "react";
import { describeWhen, fromLocalInput, type TimePreset } from "@/lib/utils/schedule";
import { Sheet, SheetHeading } from "./sheet";

/**
 * Pick a time: presets as 52px rows, then your own time (the phone's own date
 * and time wheels). Used for "Send later" and "Remind me".
 */
export function TimeSheet({
  open,
  onOpenChange,
  title,
  presets,
  timezone,
  pending,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  presets: TimePreset[];
  timezone: string;
  pending?: boolean;
  onPick: (at: Date) => void;
}) {
  const [custom, setCustom] = useState("");
  const customAt = custom ? fromLocalInput(custom, timezone) : null;
  const customOk = customAt !== null && customAt.getTime() > Date.now() + 60_000;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} blur={false}>
      <SheetHeading>{title}</SheetHeading>
      <div className="min-h-0 overflow-y-auto">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(p.at)}
            className="flex min-h-[52px] w-full items-center gap-[12px] border-t border-border-subtle px-[18px] text-left active:bg-bg-hover disabled:opacity-60"
          >
            <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{p.label.split(" at ")[0]}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
              {describeWhen(p.at, timezone).replace(/^Today at /, "")}
            </span>
          </button>
        ))}
        <form
          className="flex items-center gap-[10px] border-t border-border-subtle px-[18px] py-[12px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (customAt && customOk) onPick(customAt);
          }}
        >
          <input
            type="datetime-local"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Choose a time"
            className="field-focus block h-[44px] min-w-0 flex-1 appearance-none rounded-[10px] border border-border-input bg-bg-card px-[12px] text-left text-[15px] text-ink outline-none [&::-webkit-date-and-time-value]:text-left"
          />
          <button
            type="submit"
            disabled={pending || !customOk}
            className="flex h-[44px] shrink-0 items-center rounded-[11px] border border-accent-border bg-primary px-[16px] text-[14px] font-semibold text-white disabled:border-border-strong disabled:bg-bg-subtle disabled:text-muted-foreground"
          >
            Set
          </button>
        </form>
      </div>
    </Sheet>
  );
}

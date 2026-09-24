"use client";

import { useMarkAllRead } from "@/components/activity/activity-item";

/** Activity's header action (design: 44px tall, 11px radius, outline on the card surface). */
export function MarkReadButton() {
  const { markAllRead, pending } = useMarkAllRead();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={markAllRead}
      className="mr-[8px] flex h-[44px] shrink-0 items-center rounded-[11px] border border-border-strong bg-bg-card px-[11px] text-[12.5px] font-semibold text-ink active:bg-bg-subtle disabled:opacity-60"
    >
      Mark read
    </button>
  );
}

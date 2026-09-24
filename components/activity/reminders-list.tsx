"use client";

import { AlarmClock, Hash, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { MobileLink } from "@/components/mobile/mobile-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cancelReminderAction } from "@/lib/actions/scheduling";
import { messageHref } from "@/lib/queries/activity";
import { useUpcomingReminders, type UpcomingReminder } from "@/lib/queries/use-scheduling";
import { cn } from "@/lib/utils";
import { describeWhen } from "@/lib/utils/schedule";

/**
 * Upcoming reminders on the Activity page, with cancel (§5 Phase 3). On the
 * phone the rows sit at the feed's 16px inset and cancel is a 44px target.
 */
export function RemindersList({
  initial,
  timezone,
  variant = "desktop",
}: {
  initial: UpcomingReminder[];
  timezone: string;
  variant?: "desktop" | "mobile";
}) {
  const mobile = variant === "mobile";
  const RowLink = mobile ? MobileLink : Link;
  const { data, refetch } = useUpcomingReminders(initial);
  const [pending, startTransition] = useTransition();
  const items = data ?? [];

  const cancel = (id: string) =>
    startTransition(async () => {
      const result = await cancelReminderAction({ id });
      if (!result.ok) toast.error(result.error);
      else toast.success("Reminder cancelled");
      void refetch();
    });

  if (items.length === 0) {
    return (
      <p className={cn("border-b border-border-subtle py-[13px] text-[13px] leading-[1.55] text-fg-600", mobile ? "px-[16px]" : "px-5")}>
        {mobile ? "No reminders coming up." : "No reminders coming up. Hover a message and choose the alarm clock to set one."}
      </p>
    );
  }

  return (
    <ul>
      {items.map((r) => {
        const m = r.message;
        return (
          <li key={r.id} className="flex items-start border-b border-border-subtle transition-colors hover:bg-bg-hover">
            <RowLink
              href={messageHref({ id: m.id, parent_id: m.parent_id, channel: m.channel, conversation: m.conversation })}
              className={cn("flex min-w-0 flex-1 gap-3 py-[13px]", mobile ? "pr-[4px] pl-[16px]" : "px-5")}
            >
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border border-accent-surface-border bg-accent-surface text-accent-foreground">
                <AlarmClock className="size-[15px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-1.5 text-[13.5px] text-fg-400">
                  <span className="font-semibold text-ink">{describeWhen(r.remind_at, timezone)}</span>
                  <span>·</span>
                  <span className="font-semibold text-fg-400">{m.author?.display_name ?? "Someone"}</span>
                  <span>in</span>
                  {m.channel ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-fg-400">
                      <Hash className="size-[11px] text-muted-foreground" aria-hidden="true" />
                      {m.channel.name}
                    </span>
                  ) : (
                    <span className="font-semibold text-fg-400">a direct message</span>
                  )}
                </span>
                <span className="mt-[5px] block truncate text-[13.5px] leading-[1.55] text-body">
                  {m.content_text || "A message with a file"}
                </span>
              </span>
            </RowLink>
            {mobile ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => cancel(r.id)}
                aria-label="Cancel reminder"
                className="mt-[8px] mr-[6px] grid size-[44px] shrink-0 place-items-center rounded-[10px] text-fg-600 active:bg-bg-subtle"
              >
                <X className="size-[17px]" strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : (
              <div className="shrink-0 py-[13px] pr-5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cancel(r.id)}
                      aria-label="Cancel reminder"
                      className="grid size-7 place-items-center rounded-[7px] text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
                    >
                      <X className="size-[15px]" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Cancel reminder</TooltipContent>
                </Tooltip>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

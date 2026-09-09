"use client";

import { AlarmClock, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cancelReminderAction } from "@/lib/actions/scheduling";
import { messageHref } from "@/lib/queries/activity";
import { useUpcomingReminders, type UpcomingReminder } from "@/lib/queries/use-scheduling";
import { describeWhen } from "@/lib/utils/schedule";

/** Upcoming reminders on the Activity page, with cancel (§5 Phase 3). */
export function RemindersList({ initial, timezone }: { initial: UpcomingReminder[]; timezone: string }) {
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
    return <p className="px-3 py-6 text-[13px] text-muted-foreground">No reminders coming up. Hover a message and choose the alarm clock to set one.</p>;
  }

  return (
    <ul className="mt-2 space-y-0.5">
      {items.map((r) => {
        const m = r.message;
        const where = m.channel ? `#${m.channel.name}` : "a direct message";
        return (
          <li key={r.id} className="group/rem flex items-start gap-1">
            <Link
              href={messageHref({ id: m.id, parent_id: m.parent_id, channel: m.channel, conversation: m.conversation })}
              className="flex min-w-0 flex-1 gap-3 rounded-lg px-3 py-2.5 hover:bg-message-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                <AlarmClock className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-[12px] text-muted-foreground">
                  <span className="truncate">
                    <span className="font-medium text-foreground">{describeWhen(r.remind_at, timezone)}</span> · {m.author?.display_name ?? "Someone"} in {where}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[14px]">{m.content_text || "A message with a file"}</span>
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => cancel(r.id)}
                  aria-label="Cancel reminder"
                  className="mt-2 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/rem:opacity-100"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Cancel reminder</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

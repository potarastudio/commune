"use client";

import { Bell, BellOff, AtSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setNotificationLevelAction } from "@/lib/actions/channels";
import type { NotificationLevel } from "@/lib/queries/channels";

const OPTIONS: { value: NotificationLevel; label: string; hint: string; icon: typeof Bell }[] = [
  { value: "all", label: "All", hint: "Every message counts as unread", icon: Bell },
  { value: "mentions", label: "Mentions", hint: "Only @you, @channel and @here", icon: AtSign },
  { value: "muted", label: "Muted", hint: "No badge, no bold", icon: BellOff },
];

/** Per-channel notification level (§5). Drives the sidebar badge rules. */
export function NotificationLevelControl({
  channelId,
  level,
  compact = false,
}: {
  channelId: string;
  level: NotificationLevel;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(level);

  const choose = (value: NotificationLevel) => {
    if (value === optimistic) return;
    startTransition(async () => {
      setOptimistic(value);
      const result = await setNotificationLevelAction({ channelId, level: value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div role="radiogroup" aria-label="Notifications" className={`grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 ${pending ? "opacity-70" : ""}`}>
      {OPTIONS.map((o) => {
        const active = optimistic === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => choose(o.value)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
              active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <o.icon className="size-3.5" aria-hidden="true" />
            {!compact && o.label}
            {compact && <span className="sr-only">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

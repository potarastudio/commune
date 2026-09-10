"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { MARK_READ_EVENT } from "@/components/shortcuts/keyboard-shortcuts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { markReadAction } from "@/lib/actions/messages";
import type { Container, MessageAuthor } from "@/lib/queries/messages";
import { clearUnread, fetchUnreadMap, unreadKeys, type UnreadMap } from "@/lib/queries/unreads";
import { cn } from "@/lib/utils";

function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "d MMM, HH:mm");
}

/**
 * One row of a feed view (activity, search). The design gives every feed the
 * same rhythm: a round 34px avatar with a 17px kind badge, an eyebrow that names the
 * actor and the place, the excerpt at 13.5/1.55, and a hairline between rows.
 */
export function ActivityItem({
  href,
  person,
  eyebrow,
  createdAt,
  timeLabel,
  badge,
  badgeTone = "neutral",
  quote,
  action,
  children,
}: {
  href: string;
  person: MessageAuthor | null;
  eyebrow: React.ReactNode;
  createdAt: string;
  /** Overrides the relative time — pass one when the list already groups by day. */
  timeLabel?: string;
  /** 9px glyph in the badge on the avatar (@ for a mention, emoji for a reaction). */
  badge?: React.ReactNode;
  badgeTone?: "accent" | "neutral";
  /** The message being reacted to or replied to, shown as a quoted excerpt. */
  quote?: React.ReactNode;
  /** Rendered beside the row, outside the link (e.g. remove from saved). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const name = person?.display_name ?? "Someone";
  return (
    <li className="group/item flex items-start border-b border-border-subtle transition-colors hover:bg-bg-hover">
      <Link href={href} className="flex min-w-0 flex-1 gap-3 px-5 py-[13px]">
        <span className="relative block size-[34px] shrink-0">
          <Avatar className="size-[34px]">
            <AvatarImage src={person?.avatar_url ?? undefined} alt="" className="object-cover" />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          {badge && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-[3px] -bottom-[3px] grid size-[17px] place-items-center rounded-full border-2 border-bg-main [&>svg]:size-[9px]",
                badgeTone === "accent" ? "bg-primary text-primary-foreground" : "bg-bg-avatar text-fg-600",
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5 text-[13.5px] text-fg-400">
            {eyebrow}
            <time dateTime={createdAt} className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
              {timeLabel ?? when(createdAt)}
            </time>
          </div>
          <div className="mt-[5px] text-[13.5px] leading-[1.55] text-body [text-wrap:pretty] [&>p]:inline">{children}</div>
          {quote && (
            <div className="mt-[7px] border-l-2 border-border-strong py-px pl-2.5 text-[13px] leading-[1.5] text-fg-600 [&>p]:inline">
              {quote}
            </div>
          )}
        </div>
      </Link>
      {action && <div className="shrink-0 py-[13px] pr-5">{action}</div>}
    </li>
  );
}

function containerFromKey(key: string): Container | null {
  const [kind, id] = key.split(":");
  return kind === "channel" || kind === "conversation" ? { kind, id } : null;
}

/**
 * The Activity header's right-aligned "Mark all read" (32px outline chip, as the
 * design draws it). There is no per-row read flag on mentions and reactions, so
 * the honest thing to clear is what the app actually tracks as unread: every
 * channel and DM carrying an unread count. Same path as Shift+Esc — patch the
 * unread cache first so the sidebar settles instantly, then persist.
 */
export function MarkAllReadButton() {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const { data: unreads } = useQuery({ queryKey: unreadKeys.all, queryFn: fetchUnreadMap, staleTime: 15_000 });

  const markAllRead = () =>
    startTransition(async () => {
      const map = (queryClient.getQueryData<UnreadMap>(unreadKeys.all) ?? unreads ?? {}) as UnreadMap;
      const targets = Object.entries(map)
        .filter(([, v]) => v.unread > 0)
        .map(([key]) => containerFromKey(key))
        .filter((c): c is Container => c !== null);

      window.dispatchEvent(new CustomEvent(MARK_READ_EVENT));
      if (targets.length === 0) {
        toast("Nothing unread", { description: "You're all caught up." });
        return;
      }
      for (const c of targets) clearUnread(queryClient, c);
      const results = await Promise.all(targets.map((container) => markReadAction({ container })));
      if (results.some((r) => !r.ok)) {
        toast.error("Couldn't mark everything as read", { description: "Try again in a moment." });
        void queryClient.invalidateQueries({ queryKey: unreadKeys.all });
      } else {
        toast.success(targets.length === 1 ? "Marked 1 conversation as read" : `Marked ${targets.length} conversations as read`);
      }
    });

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={markAllRead} className="h-8 px-[11px]">
      Mark all read
    </Button>
  );
}

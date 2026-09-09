"use client";

import { format, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MessageAuthor } from "@/lib/queries/messages";
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

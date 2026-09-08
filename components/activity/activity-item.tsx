"use client";

import { format, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MessageAuthor } from "@/lib/queries/messages";

function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "d MMM, HH:mm");
}

export function ActivityItem({
  href,
  person,
  eyebrow,
  createdAt,
  children,
}: {
  href: string;
  person: MessageAuthor | null;
  eyebrow: React.ReactNode;
  createdAt: string;
  children: React.ReactNode;
}) {
  const name = person?.display_name ?? "Someone";
  return (
    <li>
      <Link
        href={href}
        className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-message-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <Avatar className="mt-0.5 size-8 rounded-md">
          <AvatarImage src={person?.avatar_url ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="rounded-md bg-accent text-[12px] font-semibold text-accent-foreground">
            {name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-[12px] text-muted-foreground">
            <span className="truncate">{eyebrow}</span>
            <time dateTime={createdAt} className="ml-auto shrink-0 tabular-nums">
              {when(createdAt)}
            </time>
          </p>
          <div className="mt-0.5 text-[14px] leading-[1.5] [&>p]:inline">{children}</div>
        </div>
      </Link>
    </li>
  );
}

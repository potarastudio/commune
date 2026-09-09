"use client";

import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";
import { Hash, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MessageAuthor } from "@/lib/queries/messages";

/** Times are shown in the viewer's timezone (§6), so the rows render on the client. */
function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Today ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE HH:mm");
  return format(d, "d MMM");
}

export type SearchResultRow = {
  id: string;
  href: string;
  author: MessageAuthor | null;
  createdAt: string;
  /** Where the message lives: a channel name, or the label of a conversation. */
  where: { kind: "channel" | "dm"; label: string };
  inThread: boolean;
  /** The excerpt, already highlighted server-side. */
  snippet: React.ReactNode;
};

/**
 * Search results, from the design's search page: borderless r10 cards that take
 * --bg-hover under the pointer, a 32px avatar, then a baseline row of the
 * 13.5/600 author, the place beside its glyph and a 12px tabular time, with the
 * excerpt at 13.5/1.55 underneath. No hairline between rows — the card is the
 * separation.
 */
export function SearchResults({ rows }: { rows: SearchResultRow[] }) {
  return (
    <ul>
      {rows.map((r) => {
        const name = r.author?.display_name ?? "Someone";
        const Glyph = r.where.kind === "channel" ? Hash : MessageSquare;
        return (
          <li key={r.id}>
            <Link
              href={r.href}
              className="flex gap-3 rounded-lg px-3 py-[11px] transition-colors hover:bg-bg-hover"
            >
              <Avatar>
                <AvatarImage src={r.author?.avatar_url ?? undefined} alt="" className="object-cover" />
                <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">{name}</span>
                  <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Glyph className="size-[11px] shrink-0" aria-hidden="true" />
                    {r.where.label}
                  </span>
                  {r.inThread && <span className="text-[12px] text-muted-foreground">in a thread</span>}
                  <time dateTime={r.createdAt} className="text-[12px] tabular-nums text-muted-foreground">
                    {when(r.createdAt)}
                  </time>
                </div>
                <p className="mt-[3px] text-[13.5px] leading-[1.55] text-body [text-wrap:pretty]">{r.snippet}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

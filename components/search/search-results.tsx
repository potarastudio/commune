"use client";

import { ChevronDown, Hash, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MessageAuthor } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";
import { daysAgo, formatMessageTime, formatShortDate, formatWeekdayShort } from "@/lib/utils/time";
import { useViewerTimezone } from "@/lib/viewer-timezone";

/** "Today 21:07", "Yesterday 09:15", "Thu 14:07" within the week, then "10 Sep", in the viewer's zone (§6). */
function when(iso: string, tz: string, now = new Date()) {
  const ago = daysAgo(iso, tz, now);
  if (ago === 0) return `Today ${formatMessageTime(iso, tz)}`;
  if (ago === 1) return `Yesterday ${formatMessageTime(iso, tz)}`;
  if (ago < 7) return `${formatWeekdayShort(iso, tz)} ${formatMessageTime(iso, tz)}`;
  return formatShortDate(iso, tz, now);
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
 * The design's result-type facet bar. Its own labels (Messages / Files /
 * Channels / People) assume a search that spans more than messages; Phase 1
 * indexes messages only, so the facets are cut from what a message hit
 * actually tells us — where it lives, and whether it is a thread reply. Counts
 * are the real ones for the loaded page of results.
 */
type FacetId = "all" | "channels" | "dms" | "threads";

const FACETS: { id: FacetId; label: string; match: (r: SearchResultRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "channels", label: "Channels", match: (r) => r.where.kind === "channel" },
  { id: "dms", label: "Direct messages", match: (r) => r.where.kind === "dm" },
  { id: "threads", label: "Threads", match: (r) => r.inThread },
];

/**
 * The design's right-aligned sort control. "Most relevant" is the order the
 * search function ranks in, so it stays the default; "Newest first" re-sorts
 * the rows already in hand.
 */
const SORTS = [
  { id: "relevance", label: "Most relevant" },
  { id: "newest", label: "Newest first" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

/**
 * Search results, from the design's search page: a 30px facet row above the
 * scroller, then borderless r10 cards that take --bg-hover under the pointer,
 * a 32px r9 avatar (the search row is the documented exception to round
 * avatars), then a baseline row of the 13.5/600 author, the place beside its
 * glyph and a 12px tabular time, with the excerpt at 13.5/1.55 underneath. No
 * hairline between rows — the card is the separation.
 */
export function SearchResults({
  rows,
  query,
  moreHref,
}: {
  rows: SearchResultRow[];
  query: string;
  /** Set when the server capped the page and a wider one can be asked for. */
  moreHref: string | null;
}) {
  const tz = useViewerTimezone();
  const [facet, setFacet] = useState<FacetId>("all");
  const [sort, setSort] = useState<SortId>("relevance");

  const counts = useMemo(() => {
    const out = {} as Record<FacetId, number>;
    for (const f of FACETS) out[f.id] = rows.filter(f.match).length;
    return out;
  }, [rows]);

  const shown = useMemo(() => {
    const active = FACETS.find((f) => f.id === facet) ?? FACETS[0];
    const list = rows.filter(active.match);
    return sort === "newest" ? [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : list;
  }, [rows, facet, sort]);

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? SORTS[0].label;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-5 py-[10px]">
        {FACETS.map((f) => {
          const active = f.id === facet;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              disabled={counts[f.id] === 0}
              onClick={() => setFacet(f.id)}
              className={cn(
                "flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border px-[11px] text-[12.5px] font-semibold shadow-xs transition-colors",
                "disabled:pointer-events-none disabled:text-tertiary disabled:shadow-none",
                active
                  ? "border-accent-border bg-primary text-primary-foreground"
                  : "border-border-strong bg-bg-card text-fg-400 hover:border-border-hover hover:bg-bg-card-hover",
              )}
            >
              {f.label}
              <span className="tabular-nums">{counts[f.id]}</span>
            </button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Sort results — currently ${sortLabel.toLowerCase()}`}
              className="ml-auto flex h-[30px] shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink data-[state=open]:bg-bg-subtle data-[state=open]:text-ink"
            >
              {sortLabel}
              <ChevronDown className="size-[13px] shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[172px]">
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortId)}>
              {SORTS.map((s) => (
                <DropdownMenuRadioItem key={s.id} value={s.id}>
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto px-[14px] pt-[10px] pb-4">
        <p className="px-3 pt-1 pb-2 text-[12.5px] text-fg-600" aria-live="polite">
          <span className="font-semibold text-ink">
            {shown.length} result{shown.length === 1 ? "" : "s"}
          </span>{" "}
          for &ldquo;{query}&rdquo;
        </p>

        <ul>
          {shown.map((r) => {
            const name = r.author?.display_name ?? "Someone";
            const Glyph = r.where.kind === "channel" ? Hash : MessageSquare;
            return (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="flex gap-3 rounded-lg px-3 py-[11px] transition-colors hover:bg-bg-hover"
                >
                  {/* The search row is the design's rounded-square 32px avatar. */}
                  <Avatar className="rounded-[9px]">
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
                      {/* "Today" depends on the moment; keep the server's word through hydration. */}
                      <time dateTime={r.createdAt} className="text-[12px] tabular-nums text-muted-foreground" suppressHydrationWarning>
                        {when(r.createdAt, tz)}
                      </time>
                    </div>
                    <p className="mt-[3px] text-[13.5px] leading-[1.55] text-body [text-wrap:pretty]">{r.snippet}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* The design closes the list with a centred 34px "Show more". */}
        {moreHref && (
          <div className="flex justify-center pt-[14px] pb-1">
            <Link
              href={moreHref}
              scroll={false}
              className="flex h-[34px] items-center rounded-md border border-border-strong bg-bg-card px-[14px] text-[13px] font-semibold text-ink shadow-xs transition-colors hover:bg-bg-card-hover"
            >
              Show more results
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

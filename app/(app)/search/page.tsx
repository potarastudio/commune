import type { Metadata } from "next";
import { CircleAlert, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults, type SearchResultRow } from "@/components/search/search-results";
import { messageHref } from "@/lib/queries/activity";
import { conversationLabel, getMyConversations } from "@/lib/queries/conversations";
import { getCurrentProfile } from "@/lib/queries/profile";
import { searchMessages } from "@/lib/queries/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { highlightText, snippetAround } from "@/lib/utils/highlight";
import { highlightTerms, isEmptySearch, parseSearchQuery } from "@/lib/utils/search-query";

export const metadata: Metadata = { title: "Search" };

const TIPS = [
  ["from:@sari", "messages by a person"],
  ["in:#design", "inside one channel"],
  ["after:2026-09-01", "newer than a date"],
  ["before:2026-09-08", "older than a date"],
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const parsed = parseSearchQuery(q);
  const empty = isEmptySearch(parsed);
  const [outcome, conversations] = empty
    ? [null, []]
    : await Promise.all([searchMessages(supabase, parsed), getMyConversations(supabase)]);
  const terms = highlightTerms(parsed.terms);
  const dmLabel = (id: string) => {
    const c = conversations.find((x) => x.id === id);
    return c ? conversationLabel(c.members, profile.id, { short: true }) : "a direct message";
  };
  const found = outcome?.ok ? outcome.results.length : 0;
  const rows: SearchResultRow[] = outcome?.ok
    ? outcome.results.map((r) => ({
        id: r.id,
        href: messageHref(r),
        author: r.author,
        createdAt: r.created_at,
        where: r.channel
          ? ({ kind: "channel", label: r.channel.name } as const)
          : ({ kind: "dm", label: r.conversation ? dmLabel(r.conversation.id) : "a direct message" } as const),
        inThread: Boolean(r.parent_id),
        snippet: highlightText(snippetAround(r.content_text, terms), terms),
      }))
    : [];

  return (
    <>
      {/* The design puts the field itself in the view header — no title beside it. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="sr-only">Search</h1>
        <SearchForm initialQuery={q} />
        <kbd
          aria-hidden="true"
          className="inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-sm border border-border-strong bg-bg-subtle px-[5px] font-sans text-[11px] font-semibold text-fg-400"
        >
          ⌘K
        </kbd>
      </header>

      {/* The design's facet row: 30px chips at 12.5/600 on --bg-card, hairlined and
          shadowed. Phase 1 searches messages only, so these carry the operators
          rather than result counts. */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-5 py-[10px]">
        {TIPS.map(([code, hint]) => (
          <span
            key={code}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-bg-card px-[11px] text-[12.5px] font-semibold text-fg-400 shadow-xs"
          >
            <code>{code}</code>
            <span className="font-normal text-muted-foreground">{hint}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {empty && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
            <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
              <Search className="size-[17px]" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">
              Search everything the studio has said
            </h2>
            <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
              Type a few words, or narrow it down with the operators above. Search covers the channels and
              conversations you are in.
            </p>
          </div>
        )}

        {/* The only failure surface on this view, so it carries the tone the way the
            design's error toast does: --danger in the border and the glyph, never a fill. */}
        {outcome && !outcome.ok && (
          <div className="px-5 pt-4">
            <p className="flex items-start gap-2.5 rounded-lg border border-danger bg-bg-card px-[14px] py-3 text-[13px] leading-[1.55] text-body">
              <CircleAlert className="mt-px size-[15px] shrink-0 text-danger" aria-hidden="true" />
              <span>{outcome.unresolved}</span>
            </p>
          </div>
        )}

        {outcome?.ok && found === 0 && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
            <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
              <Search className="size-[17px]" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No messages match</h2>
            <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
              Try fewer words, check the spelling, or drop a filter. Search only covers channels and conversations
              you are in.
            </p>
          </div>
        )}

        {outcome?.ok && found > 0 && (
          <div className="px-[14px] pt-[10px] pb-4">
            <p className="px-3 pt-1 pb-2 text-[12.5px] text-fg-600">
              <span className="font-semibold text-ink">
                {found === 50 ? "First 50 results" : `${found} result${found === 1 ? "" : "s"}`}
              </span>{" "}
              for &ldquo;{q}&rdquo;
            </p>
            <SearchResults rows={rows} />
          </div>
        )}
      </div>
    </>
  );
}

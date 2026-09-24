import type { Metadata } from "next";
import { CircleAlert, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { SearchForm, SearchTips } from "@/components/search/search-form";
import { SearchResults, type SearchResultRow } from "@/components/search/search-results";
import { SearchScreen, type MobileSearchChannel, type MobileSearchPerson } from "@/components/mobile/search-screen";
import { isMobileRequest } from "@/lib/mobile-server";
import { messageHref } from "@/lib/queries/activity";
import { conversationLabel, getMyConversations } from "@/lib/queries/conversations";
import { getCurrentProfile } from "@/lib/queries/profile";
import { searchMessages } from "@/lib/queries/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { highlightText, snippetAround } from "@/lib/utils/highlight";
import { highlightTerms, isEmptySearch, parseSearchQuery } from "@/lib/utils/search-query";

export const metadata: Metadata = { title: "Search" };

/** One page of results, and the ceiling "Show more results" walks up to. */
const PAGE_SIZE = 50;
const MAX_RESULTS = 500;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; n?: string }> }) {
  const { q = "", n } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const asked = Math.floor(Number(n));
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, PAGE_SIZE), MAX_RESULTS) : PAGE_SIZE;

  const parsed = parseSearchQuery(q);
  const empty = isEmptySearch(parsed);
  const [outcome, conversations] = empty
    ? [null, []]
    : await Promise.all([searchMessages(supabase, parsed, limit), getMyConversations(supabase)]);
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
  // A full page probably means there is more behind it; ask for a wider one.
  const moreHrefForPhone =
    found === limit && limit < MAX_RESULTS ? `/search?q=${encodeURIComponent(q)}&n=${Math.min(limit + PAGE_SIZE, MAX_RESULTS)}` : null;

  // The phone's search also finds channels and people: it is the only switcher there is.
  if (await isMobileRequest()) {
    const dmWhere = (id: string | null) => {
      const c = id ? conversations.find((x) => x.id === id) : undefined;
      if (!c) return "a direct message";
      if (c.members.length <= 1) return "your notes";
      return c.members.length === 2 ? "your DM" : conversationLabel(c.members, profile.id, { short: true });
    };
    // Plain words only, and nothing PostgREST reads as filter syntax.
    const word = parsed.terms.replace(/[^\p{L}\p{N} _.-]/gu, " ").trim();
    const [channelRows, peopleRows] = word
      ? await Promise.all([
          supabase
            .from("channels")
            .select("id, name, is_private, topic, channel_members(count)")
            .eq("is_archived", false)
            .ilike("name", `%${word.replace(/\s+/g, "-")}%`)
            .order("name")
            .limit(6),
          supabase
            .from("profiles")
            .select("id, handle, display_name, avatar_url, title")
            .or(`display_name.ilike.%${word}%,handle.ilike.%${word}%`)
            .order("display_name")
            .limit(6),
        ])
      : [null, null];
    const channels: MobileSearchChannel[] = (channelRows?.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      is_private: c.is_private,
      topic: c.topic,
      member_count: (c.channel_members as unknown as { count: number }[])[0]?.count ?? 0,
    }));
    const people: MobileSearchPerson[] = peopleRows?.data ?? [];
    return (
      <SearchScreen
        query={q}
        meId={profile.id}
        messages={rows.map((r, i) => ({
          id: r.id,
          href: r.href,
          author: r.author,
          createdAt: r.createdAt,
          // "Sari in #design"; a DM is already between you, so it only says which kind of place it was.
          where: r.where.kind === "channel" ? `#${r.where.label}` : dmWhere(outcome?.ok ? (outcome.results[i]?.conversation?.id ?? null) : null),
          snippet: r.snippet,
        }))}
        channels={channels}
        people={people}
        error={outcome && !outcome.ok ? outcome.unresolved : null}
        moreHref={moreHrefForPhone}
      />
    );
  }

  const moreHref =
    found === limit && limit < MAX_RESULTS
      ? `/search?q=${encodeURIComponent(q)}&n=${Math.min(limit + PAGE_SIZE, MAX_RESULTS)}`
      : null;

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

      {/* With results, the row under the header is the design's facet bar and the
          list owns the scroller; the empty and error states get the pane to
          themselves, with the operator chips where the design puts them. */}
      {outcome?.ok && found > 0 ? (
        <SearchResults rows={rows} query={q} moreHref={moreHref} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {empty && (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
              <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
                <Search className="size-[17px]" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">
                Search everything the studio has said
              </h2>
              <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
                Type a few words, or narrow it down with an operator. Search covers the channels and conversations
                you are in.
              </p>
              <SearchTips />
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
              <SearchTips />
            </div>
          )}
        </div>
      )}
    </>
  );
}

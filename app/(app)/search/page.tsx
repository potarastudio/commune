import type { Metadata } from "next";
import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import { ActivityItem } from "@/components/activity/activity-item";
import { SearchForm } from "@/components/search/search-form";
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

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Search</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-3 py-6">
          <SearchForm initialQuery={q} />

          {empty && (
            <div className="mt-10 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Search className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[18px] font-semibold tracking-tight">Search everything the studio has said</h2>
              <p className="mt-1 text-muted-foreground">Type a few words, or narrow it down:</p>
              <dl className="mx-auto mt-5 grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-2 text-left text-[13px]">
                {TIPS.map(([code, hint]) => (
                  <div key={code} className="contents">
                    <dt>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">{code}</code>
                    </dt>
                    <dd className="text-muted-foreground">{hint}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {outcome && !outcome.ok && (
            <p className="mt-6 rounded-lg border border-border bg-muted px-4 py-3 text-[13px]">{outcome.unresolved}</p>
          )}

          {outcome?.ok && outcome.results.length === 0 && (
            <div className="mt-10 text-center">
              <h2 className="text-[16px] font-semibold tracking-tight">No messages match</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Try fewer words, check the spelling, or drop a filter. Search only covers channels and conversations you are in.
              </p>
            </div>
          )}

          {outcome?.ok && outcome.results.length > 0 && (
            <>
              <p className="mt-6 px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {outcome.results.length === 50 ? "First 50 results" : `${outcome.results.length} result${outcome.results.length === 1 ? "" : "s"}`}
              </p>
              <ul className="mt-2 space-y-0.5">
                {outcome.results.map((r) => (
                  <ActivityItem
                    key={r.id}
                    href={messageHref(r)}
                    person={r.author}
                    createdAt={r.created_at}
                    eyebrow={
                      <>
                        <span className="font-medium text-foreground">{r.author?.display_name ?? "Someone"}</span> in{" "}
                        {r.channel ? `#${r.channel.name}` : r.conversation ? dmLabel(r.conversation.id) : ""}
                        {r.parent_id ? " · in a thread" : ""}
                      </>
                    }
                  >
                    <p>{highlightText(snippetAround(r.content_text, terms), terms)}</p>
                  </ActivityItem>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}

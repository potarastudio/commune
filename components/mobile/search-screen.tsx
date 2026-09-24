"use client";

import { Hash, Lock, Search, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MessageAuthor } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";
import { feedTime } from "@/lib/utils/list-time";
import { useViewerTimezone } from "@/lib/viewer-timezone";
import { MobileLink } from "./mobile-link";
import { useMobileNav } from "./use-mobile-nav";
import { MobileEmpty, RoundFace } from "./ui";

export type MobileSearchMessage = {
  id: string;
  href: string;
  author: MessageAuthor | null;
  createdAt: string;
  where: string;
  snippet: React.ReactNode;
};
export type MobileSearchChannel = { id: string; name: string; is_private: boolean; topic: string | null; member_count: number };
export type MobileSearchPerson = { id: string; handle: string; display_name: string; avatar_url: string | null; title: string | null };

type Facet = "all" | "messages" | "channels" | "people";

/** How long typing has to pause before the results follow it. */
const DEBOUNCE_MS = 280;

function Row({ href, icon, title, meta }: { href: string; icon: React.ReactNode; title: React.ReactNode; meta: React.ReactNode }) {
  return (
    <MobileLink href={href} className="flex items-center gap-[12px] px-[16px] py-[11px] active:bg-bg-hover">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-ink [&_mark]:rounded-[3px] [&_mark]:bg-accent-surface [&_mark]:text-accent-foreground">
          {title}
        </span>
        <span className="mt-[2px] block truncate text-[12.5px] text-muted-foreground">{meta}</span>
      </span>
    </MobileLink>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="px-[16px] pt-[14px] pb-[5px] text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{children}</p>;
}

/**
 * Search on the phone (design: Mobile Core Screens → Search): a screen, not a
 * palette. The field lives in the header with Cancel beside it, results
 * follow your typing, and the counts sit on the filter chips so you know what
 * narrowing gets you. Channels and people come along with messages, since on
 * a phone this is also where you go to find them.
 */
export function SearchScreen({
  query,
  meId,
  messages,
  channels,
  people,
  error,
  moreHref,
}: {
  query: string;
  meId: string;
  messages: MobileSearchMessage[];
  channels: MobileSearchChannel[];
  people: MobileSearchPerson[];
  error: string | null;
  moreHref: string | null;
}) {
  const router = useRouter();
  const nav = useMobileNav();
  const tz = useViewerTimezone();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(query);
  const [seen, setSeen] = useState(query);
  const [facet, setFacet] = useState<Facet>("all");
  if (seen !== query) {
    setSeen(query);
    setValue(query);
  }

  // Results follow the field; replace, so Cancel still goes straight back.
  useEffect(() => {
    const q = value.trim();
    if (q === query.trim()) return;
    const t = setTimeout(() => router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false }), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, query, router]);

  const counts: Record<Facet, number> = {
    all: messages.length + channels.length + people.length,
    messages: messages.length,
    channels: channels.length,
    people: people.length,
  };
  const show = (f: Facet) => facet === "all" || facet === f;
  const searched = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-main">
      <header className="flex h-[56px] shrink-0 items-center gap-[8px] border-b border-border pr-[4px] pl-[14px]">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            input.current?.blur();
            const q = value.trim();
            router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false });
          }}
          className="flex h-[38px] min-w-0 flex-1 items-center gap-[9px] rounded-[10px] border border-border-input bg-bg-card px-[12px] transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--accent-surface)]"
        >
          <Search className="size-[16px] shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={input}
            autoFocus
            type="search"
            enterKeyHint="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search Commune"
            aria-label="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-body outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setValue("");
                input.current?.focus();
              }}
              className="-mr-[8px] grid size-[36px] shrink-0 place-items-center text-muted-foreground"
            >
              <XCircle className="size-[16px]" aria-hidden="true" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={nav.closeSurface}
          className="flex h-[44px] shrink-0 items-center px-[10px] text-[14px] font-semibold text-accent-text"
        >
          Cancel
        </button>
      </header>

      {searched && counts.all > 0 && (
        <div role="tablist" aria-label="Filter results" className="flex shrink-0 gap-[6px] overflow-x-auto border-b border-border px-[16px] py-[10px] [scrollbar-width:none]">
          {(["all", "messages", "channels", "people"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={facet === f}
              onClick={() => setFacet(f)}
              className={cn(
                "flex h-[44px] shrink-0 items-center gap-[6px] rounded-[12px] border px-[12px] text-[13px] font-semibold whitespace-nowrap",
                facet === f
                  ? "border-border-strong bg-bg-card text-ink shadow-[0_1px_2px_0_var(--shadow-tint-sm)]"
                  : "border-transparent bg-bg-chip text-fg-600",
              )}
            >
              {{ all: "All", messages: "Messages", channels: "Channels", people: "People" }[f]}
              <span className="tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(16px+var(--safe-bottom))]">
        {!searched ? (
          <MobileEmpty
            icon={<Search />}
            title="Search everything the studio has said"
            body="Messages, channels and people. Narrow it with from:@handle, in:#channel, before: or after:."
          />
        ) : error ? (
          <p className="mx-[16px] mt-[16px] rounded-[11px] border border-danger bg-bg-card px-[14px] py-[12px] text-[13.5px] leading-[1.55] text-body">{error}</p>
        ) : counts.all === 0 ? (
          <MobileEmpty
            icon={<Search />}
            title="Nothing matches"
            body="Try fewer words, check the spelling, or drop a filter. Search covers the channels and conversations you are in."
          />
        ) : (
          <>
            {show("channels") && channels.length > 0 && (
              <section>
                <Label>Channels</Label>
                {channels.map((c) => (
                  <Row
                    key={c.id}
                    href={`/channel/${c.id}`}
                    icon={
                      <span className="grid size-[36px] shrink-0 place-items-center rounded-[10px] border border-border-subtle bg-bg-chip text-fg-600">
                        {c.is_private ? <Lock className="size-[15px]" aria-hidden="true" /> : <Hash className="size-[16px]" aria-hidden="true" />}
                      </span>
                    }
                    title={c.name}
                    meta={[`${c.member_count} ${c.member_count === 1 ? "member" : "members"}`, c.topic].filter(Boolean).join(" · ")}
                  />
                ))}
              </section>
            )}
            {show("people") && people.length > 0 && (
              <section>
                <Label>People</Label>
                {people.map((p) => (
                  <Row
                    key={p.id}
                    href={`/u/${p.handle}`}
                    icon={<RoundFace person={p} size={36} />}
                    title={p.display_name}
                    meta={[`@${p.handle}`, p.id === meId ? "you" : p.title].filter(Boolean).join(" · ")}
                  />
                ))}
              </section>
            )}
            {show("messages") && messages.length > 0 && (
              <section>
                <Label>Messages</Label>
                {messages.map((m) => (
                  <Row
                    key={m.id}
                    href={m.href}
                    icon={<RoundFace person={m.author} size={36} />}
                    title={m.snippet}
                    meta={
                      <span suppressHydrationWarning>
                        {`${m.author?.id === meId ? "You" : (m.author?.display_name ?? "Someone")} in ${m.where} · ${feedTime(m.createdAt, tz)}`}
                      </span>
                    }
                  />
                ))}
                {moreHref && (
                  <div className="px-[16px] pt-[8px]">
                    <button
                      type="button"
                      onClick={() => router.replace(moreHref, { scroll: false })}
                      className="flex h-[44px] w-full items-center justify-center rounded-[11px] border border-border-strong bg-bg-card text-[14px] font-semibold text-ink"
                    >
                      Show more results
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

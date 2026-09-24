"use client";

import { Bookmark, Check } from "lucide-react";
import { useState } from "react";
import { useSavedItems } from "@/components/saved/saved-list";
import { messageHref } from "@/lib/queries/activity";
import type { SavedMessage } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";
import { feedTime } from "@/lib/utils/list-time";
import { renderContent } from "@/lib/utils/render";
import { useViewerTimezone } from "@/lib/viewer-timezone";
import { MobileLink } from "./mobile-link";
import { RootHeader } from "./screen-header";
import { TabScroll } from "./tab-scroll";
import { MobileEmpty } from "./ui";

type Filter = "all" | "channels" | "dms";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "channels", label: "Channels" },
  { id: "dms", label: "Direct messages" },
];

/**
 * Saved, the fourth tab: your reading list, newest save first. The same
 * grammar as Activity — chips to narrow, a feed row per message — with a
 * 44px check on the left that clears the item once you have dealt with it.
 */
export function SavedScreen({ meId, initialSaved }: { meId: string; initialSaved: SavedMessage[] }) {
  const tz = useViewerTimezone();
  const { items, done, markDone } = useSavedItems(meId, initialSaved);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    all: items.length,
    channels: items.filter((s) => s.message.channel).length,
    dms: items.filter((s) => !s.message.channel).length,
  };
  const visible = items.filter((s) => (filter === "all" ? true : filter === "channels" ? !!s.message.channel : !s.message.channel));

  return (
    <>
      <RootHeader title="Saved" />
      {items.length > 0 && (
        <div
          role="tablist"
          aria-label="Filter saved messages"
          className="flex shrink-0 gap-[6px] overflow-x-auto border-b border-border bg-bg-main px-[16px] py-[10px] [scrollbar-width:none]"
        >
          {FILTERS.map((f) => {
            const active = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex h-[44px] shrink-0 items-center gap-[6px] rounded-[12px] border px-[12px] text-[13px] font-semibold whitespace-nowrap",
                  active
                    ? "border-border-strong bg-bg-card text-ink shadow-[0_1px_2px_0_var(--shadow-tint-sm)]"
                    : "border-transparent bg-bg-chip text-fg-600 active:bg-bg-subtle",
                )}
              >
                {f.label}
                <span className="tabular-nums text-muted-foreground">{counts[f.id]}</span>
              </button>
            );
          })}
        </div>
      )}
      <TabScroll tab="saved">
        {items.length === 0 ? (
          <MobileEmpty
            icon={<Bookmark />}
            title="Nothing saved yet"
            body="Long-press a message and choose Save for later. It stays here until you clear it."
          />
        ) : visible.length === 0 ? (
          <p className="px-[16px] py-[16px] text-[14px] leading-[1.55] text-fg-600">
            {filter === "channels" ? "Nothing saved from a channel yet." : "Nothing saved from a direct message yet."}
          </p>
        ) : (
          <ul>
            {visible.map(({ message: m, saved_at }) => {
              const isDone = done.includes(m.id);
              return (
                <li key={m.id} className="flex items-start border-b border-border-subtle">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label="Done — clear from Saved"
                    onClick={() => markDone(m.id)}
                    className="mt-[4px] ml-[4px] grid size-[44px] shrink-0 place-items-center"
                  >
                    <span
                      className={cn(
                        "grid size-[20px] place-items-center rounded-[6px] border-[1.5px] transition-colors",
                        isDone ? "border-accent-border bg-primary text-white" : "border-border-input bg-bg-card text-transparent",
                      )}
                    >
                      <Check className="size-[12px]" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  </button>
                  <MobileLink href={messageHref(m)} className="min-w-0 flex-1 py-[13px] pr-[16px] pl-[2px] active:bg-bg-hover">
                    <div className="flex flex-wrap items-baseline gap-x-[6px] text-[12.5px] text-muted-foreground">
                      <span className="font-semibold text-fg-400">{m.channel ? `#${m.channel.name}` : "Direct message"}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-fg-400">{m.author?.display_name ?? "Someone"}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={saved_at} className="tabular-nums" suppressHydrationWarning>
                        {feedTime(saved_at, tz)}
                      </time>
                      {m.parent_id && <span>· in a thread</span>}
                    </div>
                    <div
                      className={cn(
                        "mt-[4px] line-clamp-4 text-[13.5px] leading-[1.55] [text-wrap:pretty] [&>p]:inline",
                        isDone ? "text-muted-foreground line-through" : "text-body",
                      )}
                    >
                      {m.deleted_at ? (
                        <span className="italic text-muted-foreground">This message was deleted</span>
                      ) : (
                        renderContent(m.content as Parameters<typeof renderContent>[0], { inert: true })
                      )}
                    </div>
                  </MobileLink>
                </li>
              );
            })}
          </ul>
        )}
      </TabScroll>
    </>
  );
}

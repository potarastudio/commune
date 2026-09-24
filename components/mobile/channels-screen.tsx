"use client";

import { Lock, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { JoinedChannel } from "@/lib/queries/channels";
import { useUnreadCounts } from "@/lib/queries/unreads";
import { cn } from "@/lib/utils";
import { unreadBadge, type UnreadMap } from "@/lib/utils/unreads";
import { ChannelSheet } from "./channel-sheet";
import { MobileLink } from "./mobile-link";
import { HeaderIconButton, RootHeader } from "./screen-header";
import { SCROLL_TO_TOP_EVENT, useMobileNav } from "./use-mobile-nav";
import { useRowGestures } from "./use-row-gestures";

/** Scrolls a tab root's list to the top when its tab is tapped again. */
export function useScrollToTopOnReselect(tab: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onReselect = (e: Event) => {
      if ((e as CustomEvent<string>).detail === tab) ref.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener(SCROLL_TO_TOP_EVENT, onReselect);
    return () => window.removeEventListener(SCROLL_TO_TOP_EVENT, onReselect);
  }, [tab]);
  return ref;
}

/** The design's section label: 11.5/700, tracked caps, muted, 16px in. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-[16px] pt-[16px] pb-[6px] text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{children}</p>;
}

/** An accent count pill, 20px tall. */
export function CountPill({ count, label }: { count: number; label?: string }) {
  return (
    <span
      className="shrink-0 rounded-full bg-primary px-[7px] text-[11.5px] leading-[20px] font-semibold text-white tabular-nums"
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** One channel: tap to open, hold for its actions (design: Mobile Touch → Long-press a row). */
function ChannelRow({ channel: c, badge }: { channel: JoinedChannel; badge: ReturnType<typeof unreadBadge> }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const gestures = useRowGestures({
    enabled: true,
    onLongPress: () => {
      setSheetMounted(true);
      setSheetOpen(true);
    },
  });
  return (
    <li {...gestures.handlers} className="touch-pan-y">
      <MobileLink
        href={`/channel/${c.id}`}
        data-long-press=""
        className={cn("flex h-[52px] items-center gap-[11px] px-[16px] active:bg-bg-subtle", sheetOpen && "bg-bg-subtle")}
      >
        <span
          aria-hidden="true"
          className="grid size-[32px] shrink-0 place-items-center rounded-[9px] border border-border-subtle bg-bg-chip text-[14px] font-semibold text-tertiary"
        >
          {c.is_private ? <Lock className="size-[14px]" strokeWidth={2} /> : "#"}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[14.5px]",
            badge.bold ? "font-semibold text-ink" : "text-fg-500",
            c.is_archived && "text-muted-foreground",
          )}
        >
          {c.name}
          {badge.bold && !badge.mention && <span className="sr-only">, unread messages</span>}
        </span>
        {badge.mention && badge.count > 0 && <CountPill count={badge.count} label={`${badge.count} unread, including a mention`} />}
      </MobileLink>
      {sheetMounted && <ChannelSheet channel={c} open={sheetOpen} onOpenChange={setSheetOpen} />}
    </li>
  );
}

/**
 * Channels, the first tab (design: Mobile Navigation → Push, left screen).
 * One 52px row per joined channel: a 32px tile, the name, and the unread
 * state the sidebar shows — a count for mentions, bold for anything else
 * worth reading, muted channels stay quiet.
 */
export function ChannelsScreen({
  meId,
  workspace,
  channels,
  initialUnreads,
}: {
  meId: string;
  workspace: string;
  channels: JoinedChannel[];
  initialUnreads: UnreadMap;
}) {
  const nav = useMobileNav();
  const unreads = useUnreadCounts(initialUnreads, meId);
  const list = useScrollToTopOnReselect("channels");

  return (
    <>
      <RootHeader title={workspace}>
        <HeaderIconButton label="Search" onClick={() => nav.push("/search")}>
          <Search className="size-[20px]" strokeWidth={1.75} aria-hidden="true" />
        </HeaderIconButton>
      </RootHeader>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg-main">
        <SectionLabel>Channels</SectionLabel>
        {channels.length === 0 ? (
          <p className="px-[16px] py-[10px] text-[14px] leading-[1.55] text-fg-600">
            You haven&rsquo;t joined any channels yet. Find one under You → Browse channels.
          </p>
        ) : (
          <ul>
            {channels.map((c) => {
              return <ChannelRow key={c.id} channel={c} badge={unreadBadge(unreads, `channel:${c.id}`, c.notification_level)} />;
            })}
          </ul>
        )}
      </div>
    </>
  );
}

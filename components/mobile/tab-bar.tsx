"use client";

import { useQuery } from "@tanstack/react-query";
import { AtSign, Bookmark, CornerUpLeft, Hash, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { MOBILE_TABS, TAB_ROOTS, type MobileTab } from "@/lib/mobile";
import { useMobileNavStore } from "@/lib/store/mobile-nav";
import { fetchUnreadMap, unreadKeys } from "@/lib/queries/unreads";
import { cn } from "@/lib/utils";
import { mentionConversationCount, type UnreadMap } from "@/lib/utils/unreads";
import { useMobileNav } from "./use-mobile-nav";

type Me = { display_name: string; avatar_url: string | null };

const TAB_LABELS: Record<MobileTab, string> = { channels: "Channels", activity: "Activity", dms: "DMs", saved: "Saved", you: "You" };
const HINT_KEY = "commune-tab-hint";

/**
 * The first time another tab is holding a screen open — a notification opened
 * a DM while #design was showing, say — say so once above the tab bar
 * (design: Mobile Navigation → Tab switch), so tapping that tab and landing
 * in #design rather than on the list is not a surprise.
 */
function TabResumeHint({ active }: { active: MobileTab }) {
  // Primitives only: a selector that builds a new object on every read never settles.
  const heldTab = useMobileNavStore((s) => MOBILE_TABS.find((tab) => tab !== active && s.stacks[tab].length > 1) ?? null);
  const heldTitle = useMobileNavStore((s) => {
    if (!heldTab) return null;
    const stack = s.stacks[heldTab];
    return s.titles[stack[stack.length - 1].url] ?? null;
  });
  const held = heldTab ? { tab: heldTab, title: heldTitle } : null;
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(true);

  useEffect(() => {
    try {
      setDone(window.localStorage.getItem(HINT_KEY) !== null);
    } catch {
      setDone(true);
    }
  }, []);

  useEffect(() => {
    if (done || !held?.title) return;
    setShown(true);
    try {
      window.localStorage.setItem(HINT_KEY, new Date().toISOString());
    } catch {
      // Showing it again once is harmless.
    }
    const t = setTimeout(() => {
      setShown(false);
      setDone(true);
    }, 7000);
    return () => clearTimeout(t);
  }, [done, held?.title]);

  if (!shown || !held?.title) return null;
  return (
    <div role="status" className="flex shrink-0 items-center gap-[9px] border-t border-border bg-accent-surface px-[16px] py-[9px]">
      <CornerUpLeft className="size-[14px] shrink-0 text-accent-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-accent-foreground [text-wrap:pretty]">
        {TAB_LABELS[held.tab]} still has {held.title} open — tapping it returns you there, not to the list.
      </span>
    </div>
  );
}

/**
 * The phone's five sections (design: Mobile Navigation). Only tab roots carry
 * it; a pushed screen replaces it with that screen's composer. 58px plus the
 * home-indicator inset; the active tab's icon takes the accent and its label
 * the ink, the rest are muted. Activity counts conversations with an unread
 * mention, the same number the desktop rail shows.
 */
export function TabBar({
  active,
  me,
  initialUnreads,
  mutedChannelIds,
}: {
  active: MobileTab;
  me: Me;
  initialUnreads: UnreadMap;
  mutedChannelIds: string[];
}) {
  const nav = useMobileNav();
  // Shares the cache and realtime patches with every other unread reader.
  const { data: unreads } = useQuery({
    queryKey: unreadKeys.all,
    queryFn: fetchUnreadMap,
    initialData: initialUnreads,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const mentions = mentionConversationCount(unreads, mutedChannelIds);

  const tabs: { tab: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { tab: "channels", label: "Channels", icon: <Hash className="size-[21px]" strokeWidth={1.75} aria-hidden="true" /> },
    { tab: "activity", label: "Activity", icon: <AtSign className="size-[21px]" strokeWidth={1.75} aria-hidden="true" />, badge: mentions },
    { tab: "dms", label: "DMs", icon: <MessageSquareText className="size-[21px]" strokeWidth={1.75} aria-hidden="true" /> },
    { tab: "saved", label: "Saved", icon: <Bookmark className="size-[21px]" strokeWidth={1.75} aria-hidden="true" /> },
    {
      tab: "you",
      label: "You",
      icon: (
        <span className="grid size-[21px] place-items-center overflow-hidden rounded-full bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]">
          {me.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatars come from storage and Google, sized by CSS
            <img src={me.avatar_url} alt="" className="size-[21px] object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-fg-600">{me.display_name.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
    <TabResumeHint active={active} />
    <nav aria-label="Sections" className="pb-safe flex shrink-0 border-t border-border bg-bg-main">
      {tabs.map(({ tab, label, icon, badge }) => {
        const current = tab === active;
        return (
          <a
            key={tab}
            href={TAB_ROOTS[tab]}
            aria-current={current ? "page" : undefined}
            aria-label={badge ? `${label}, ${badge} with unread mentions` : label}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              nav.switchTab(tab);
            }}
            className={cn(
              "flex h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] focus-visible:outline-offset-[-3px]",
              current ? "text-ink" : "text-muted-foreground",
            )}
          >
            <span className={cn("relative block", current && tab !== "you" ? "text-primary" : undefined)}>
              {icon}
              {badge ? (
                <span className="absolute -top-[3px] -right-[6px] box-border h-[15px] min-w-[15px] rounded-full border-2 border-bg-main bg-primary px-[3px] text-center text-[9.5px] leading-[11px] font-bold text-white tabular-nums">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            <span className="text-[10.5px] font-semibold tracking-[0.01em]">{label}</span>
          </a>
        );
      })}
    </nav>
    </>
  );
}

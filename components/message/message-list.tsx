"use client";

import { Hash, MessageCircle } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import type { Message, MessageAuthor } from "@/lib/queries/messages";
import { formatDayLabel, sameDay, shouldGroup } from "@/lib/utils/time";
import { Skeleton } from "@/components/ui/skeleton";
import { ReplySummary } from "@/components/thread/reply-summary";
import { DateDivider } from "./date-divider";
import { MessageItem } from "./message-item";

/**
 * The design reserves one 22px line between the log and the composer, and the
 * container decides what goes in it — the typing indicator, or a DM's "they are
 * away" line. A page sets it here rather than passing a prop, because the pane
 * that owns the composer sits between the page and this list.
 */
const ComposerNoticeContext = createContext<React.ReactNode>(null);

export function ComposerNoticeProvider({ notice, children }: { notice: React.ReactNode; children: React.ReactNode }) {
  return <ComposerNoticeContext.Provider value={notice}>{children}</ComposerNoticeContext.Provider>;
}

/** Skeleton bar widths, row by row — the design's 86 / 64+58 / 92 / 52 rhythm. */
const SKELETON_ROWS: [string, string | null][] = [
  ["86%", null],
  ["64%", "58%"],
  ["92%", null],
  ["52%", null],
];

export function MessageList({
  messages,
  me,
  isAdmin,
  lastReadAt,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onToggleReaction,
  onDelete,
  onEdit,
  onTogglePin,
  onToggleSave,
  onRetry,
  onDiscard,
  allowBroadcast,
  onOpenThread,
  participants,
  highlightId,
  startTitle,
  startBody,
  startIcon = "channel",
}: {
  messages: Message[];
  me: MessageAuthor;
  isAdmin: boolean;
  lastReadAt: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onToggleReaction: (messageId: string, emoji: string, active: boolean) => void;
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, content: JSONContent) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onToggleSave: (messageId: string, saved: boolean) => void;
  /** Failed send: re-run it. Omitted where the container has no retry path. */
  onRetry?: (messageId: string) => void;
  /** Failed send: drop the unsent draft row. */
  onDiscard?: (messageId: string) => void;
  allowBroadcast: boolean;
  onOpenThread: (messageId: string) => void;
  participants: Record<string, string[]>;
  /** From ?message=<id>: scroll to it and flash it once. */
  highlightId?: string | null;
  startTitle: string;
  startBody: string;
  startIcon?: "channel" | "conversation";
}) {
  const StartIcon = startIcon === "conversation" ? MessageCircle : Hash;
  const composerNotice = useContext(ComposerNoticeContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);
  const prevFirstId = useRef<string | null>(null);
  const prevLastId = useRef<string | null>(null);
  const highlighted = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightId || highlighted.current === highlightId) return;
    const el = document.getElementById(`message-${highlightId}`);
    if (!el) return;
    highlighted.current = highlightId;
    stickToBottom.current = false;
    el.scrollIntoView({ block: "center" });
    el.classList.add("message-flash");
    const t = setTimeout(() => el.classList.remove("message-flash"), 2500);
    return () => clearTimeout(t);
  }, [highlightId, messages]);

  // Initial render and new messages: open on the newest message and stay there
  // unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;
    // The message we last ended on is still here ⇒ this is the same list, so a
    // changed first id means an older page was prepended. If it is gone the
    // list was replaced (another container, or a refetch): open at the bottom
    // again rather than inheriting where the previous conversation was read.
    const sameList = prevLastId.current !== null && messages.some((m) => m.id === prevLastId.current);
    if (prevLastId.current !== null && !sameList) stickToBottom.current = true;
    if (sameList && prevFirstId.current !== null && firstId !== prevFirstId.current) {
      // Older page prepended: keep the viewport where it was.
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = el.scrollHeight;
    prevFirstId.current = firstId;
    prevLastId.current = lastId;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Two things move the newest message off screen after first paint, and both
    // have to be watched. The content grows (avatars, images, link previews,
    // late fonts) — that is `inner`. And the viewport shrinks under a banner or
    // notice mounting above the pane, which leaves scrollTop short of the new
    // bottom without changing the content at all — that is `el`. Neither fires
    // a scroll event, so the pin survives both.
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
      prevHeight.current = el.scrollHeight;
    });
    ro.observe(el);
    ro.observe(inner);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = topSentinel.current;
    const root = scrollRef.current;
    if (!el || !root || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          prevHeight.current = root.scrollHeight;
          onLoadMore();
        }
      },
      { root, rootMargin: "200px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  // "New messages" line goes before the first message after last_read_at from someone else.
  const firstUnreadId = lastReadAt
    ? messages.find((m) => m.author_id !== me.id && m.created_at > lastReadAt && !m.pending)?.id
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="log" aria-live="polite" aria-label="Messages">
      <div ref={innerRef} className="flex min-h-full flex-col pb-2">
        <div ref={topSentinel} aria-hidden="true" />
        {isLoadingMore && (
          <div className="shrink-0 px-4 py-5 md:px-6" aria-busy="true" aria-label="Loading older messages">
            {SKELETON_ROWS.map(([a, b], i) => {
              // The design staggers the four rows 0 / 120 / 240 / 360ms.
              const delay = { animationDelay: `${i * 120}ms` };
              return (
                <div key={i} className="flex gap-3 py-[9px]">
                  <Skeleton className="size-9 rounded-[10px]" style={delay} />
                  <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                    <div className="flex gap-2">
                      <Skeleton className="h-3 w-[108px] rounded-[4px]" style={delay} />
                      <Skeleton className="h-3 w-11 rounded-[4px]" style={delay} />
                    </div>
                    <Skeleton className="h-3 rounded-[4px]" style={{ ...delay, width: a }} />
                    {b && <Skeleton className="h-3 rounded-[4px]" style={{ ...delay, width: b }} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Two distinct treatments: the intro block sits above history, the empty state owns the pane. */}
        {!hasMore && messages.length > 0 && (
          <div className="shrink-0 px-4 pb-3 pt-8 md:px-6">
            <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">{startTitle}</h2>
            <p className="mt-[5px] max-w-[560px] text-[14px] leading-[1.55] text-fg-600">{startBody}</p>
          </div>
        )}

        {!hasMore && messages.length === 0 && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-[18px] pt-[14px] text-center md:px-6">
            <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
              <StartIcon className="size-[17px]" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">{startTitle}</h2>
            <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600">
              Nothing here yet. Say hello, share a link, or drop the first file.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || !sameDay(prev.created_at, m.created_at);
          const grouped = !newDay && shouldGroup(prev, m) && !m.deleted_at;
          return (
            <div key={m.id}>
              {newDay && <DateDivider label={formatDayLabel(m.created_at)} />}
              {m.id === firstUnreadId && <DateDivider label="New messages" tone="new" />}
              <MessageItem
                message={m}
                grouped={grouped}
                meId={me.id}
                canDelete={m.author_id === me.id || isAdmin}
                onToggleReaction={(emoji, active) => onToggleReaction(m.id, emoji, active)}
                onDelete={() => onDelete(m.id)}
                onEdit={(doc) => onEdit(m.id, doc)}
                onTogglePin={(pinned) => onTogglePin(m.id, pinned)}
                onToggleSave={(saved) => onToggleSave(m.id, saved)}
                onRetry={onRetry && m.failed ? () => onRetry(m.id) : undefined}
                onDiscard={onDiscard && m.failed ? () => onDiscard(m.id) : undefined}
                allowBroadcast={allowBroadcast}
                onReply={() => onOpenThread(m.id)}
                replySummary={
                  m.reply_count > 0 ? (
                    <ReplySummary
                      count={m.reply_count}
                      lastReplyAt={m.last_reply_at}
                      participantIds={participants[m.id] ?? []}
                      onOpen={() => onOpenThread(m.id)}
                    />
                  ) : null
                }
              />
            </div>
          );
        })}
      </div>
    </div>
    {composerNotice}
    </div>
  );
}

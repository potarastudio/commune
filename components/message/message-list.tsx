"use client";

import { Hash } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Message, MessageAuthor } from "@/lib/queries/messages";
import { formatDayLabel, sameDay, shouldGroup } from "@/lib/utils/time";
import { Skeleton } from "@/components/ui/skeleton";
import { DateDivider } from "./date-divider";
import { MessageItem } from "./message-item";

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
  channelName,
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
  channelName: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);
  const prevFirstId = useRef<string | null>(null);

  // Initial render and new messages: stay pinned to the bottom unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    if (prevFirstId.current && firstId !== prevFirstId.current) {
      // Older page prepended: keep the viewport where it was.
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = el.scrollHeight;
    prevFirstId.current = firstId;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Content grows after paint (avatars, fonts, images): stay pinned to the bottom.
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
      prevHeight.current = el.scrollHeight;
    });
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" role="log" aria-live="polite" aria-label="Messages">
      <div ref={innerRef} className="min-h-full pb-3">
        <div ref={topSentinel} aria-hidden="true" />
        {isLoadingMore && (
          <div className="space-y-3 px-5 py-3" aria-label="Loading older messages">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasMore && (
          <div className="px-5 pt-10 pb-4">
            <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Hash className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-[20px] font-semibold tracking-tight">This is the start of #{channelName}</h2>
            <p className="mt-1 text-muted-foreground">
              {messages.length === 0
                ? "Nothing here yet. Say hello, share a link, or drop the first file."
                : "Everything the channel has ever said is below."}
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
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

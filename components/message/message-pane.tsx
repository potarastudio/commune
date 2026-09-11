"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { markReadAction } from "@/lib/actions/messages";
import { scheduleMessageAction } from "@/lib/actions/scheduling";
import { ScheduledNotice } from "@/components/message/send-later";
import { schedulingKeys } from "@/lib/queries/scheduling";
import { describeWhen } from "@/lib/utils/schedule";
import { toast } from "sonner";
import { MARK_READ_EVENT } from "@/components/shortcuts/keyboard-shortcuts";
import { MessageComposer } from "@/components/message/message-composer";
import { MessageList } from "@/components/message/message-list";
import { DropZone } from "@/components/message/drop-zone";
import { useAttachmentUploads } from "@/lib/queries/use-uploads";
import { TypingIndicator } from "@/components/message/typing-indicator";
import { useTyping } from "@/lib/realtime/presence";
import { messageKeys, type Container, type MessageAuthor, type MessagePage } from "@/lib/queries/messages";
import { clearUnread } from "@/lib/queries/unreads";
import {
  useDeleteMessage,
  useEditMessage,
  useMessages,
  useReplyParticipants,
  useSendMessage,
  useTogglePin,
  useToggleReaction,
  useToggleSave,
} from "@/lib/queries/use-messages";
import { formatMessageTime } from "@/lib/utils/time";
import { useThreadNav } from "@/lib/utils/use-thread-nav";
import { useViewerTimezone } from "@/lib/viewer-timezone";

/** Scrolled more than this from the bottom counts as "reading back". */
const AWAY_FROM_BOTTOM = 240;

/** The message list + composer for any container. Channel and DM pages wrap it with their own header. */
export function MessagePane({
  container,
  me,
  isAdmin,
  canPost,
  lastReadAt,
  initialPage,
  placeholder,
  startTitle,
  startBody,
  readOnlyNotice,
}: {
  container: Container;
  me: MessageAuthor;
  isAdmin: boolean;
  canPost: boolean;
  lastReadAt: string | null;
  initialPage: MessagePage;
  placeholder: string;
  startTitle: string;
  startBody: string;
  readOnlyNotice?: React.ReactNode;
}) {
  const tz = useViewerTimezone();
  const queryClient = useQueryClient();
  const highlightId = useSearchParams().get("message");
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(container, initialPage);
  const send = useSendMessage(container, me);
  const uploads = useAttachmentUploads();
  const typing = useTyping(container, { id: me.id, name: me.display_name });
  const { openThreadId, openThread } = useThreadNav();
  const keys = openThreadId ? [messageKeys.container(container), messageKeys.thread(openThreadId)] : [messageKeys.container(container)];
  const toggleReaction = useToggleReaction(keys, me.id);
  const del = useDeleteMessage(keys);
  const edit = useEditMessage(keys);
  const pin = useTogglePin(keys);
  const save = useToggleSave(keys);
  const threaded = messages.filter((m) => m.reply_count > 0).map((m) => m.id);
  const { data: participants } = useReplyParticipants(container, threaded);

  // Esc (keyboard shortcuts) and the unread bar both mark the pane read now and drop the
  // "New messages" line.
  const [readMarker, setReadMarker] = useState(lastReadAt);
  useEffect(() => setReadMarker(lastReadAt), [container.kind, container.id, lastReadAt]);
  const markRead = useCallback(() => {
    setReadMarker(null);
    if (!canPost) return;
    clearUnread(queryClient, container);
    void markReadAction({ container });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container.kind, container.id, canPost, queryClient]);
  useEffect(() => {
    window.addEventListener(MARK_READ_EVENT, markRead);
    return () => window.removeEventListener(MARK_READ_EVENT, markRead);
  }, [markRead]);

  // Unread tracking (§5): mark read while the pane is visible and the window is focused.
  const latestAt = messages.length ? messages[messages.length - 1].created_at : null;
  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!canPost) return;
    const mark = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (lastMarked.current === latestAt) return;
      lastMarked.current = latestAt;
      clearUnread(queryClient, container);
      void markReadAction({ container });
    };
    mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container.kind, container.id, canPost, latestAt, queryClient]);

  // Jump-to-latest pill: while the reader is scrolled up, count what has arrived since.
  const listRef = useRef<HTMLDivElement>(null);
  const latestAtRef = useRef<string | null>(latestAt);
  // null ⇒ pinned to the bottom. Otherwise the newest message at the moment we scrolled away —
  // `at: null` means nothing had loaded yet, so nothing counts as new.
  const [awayFrom, setAwayFrom] = useState<{ at: string | null } | null>(null);
  useEffect(() => {
    latestAtRef.current = latestAt;
  }, [latestAt]);
  useEffect(() => {
    setAwayFrom(null);
    const el = listRef.current?.querySelector<HTMLElement>('[role="log"]');
    if (!el) return;
    const onScroll = () => {
      const away = el.scrollHeight - el.scrollTop - el.clientHeight > AWAY_FROM_BOTTOM;
      setAwayFrom((prev) => (away ? (prev ?? { at: latestAtRef.current }) : null));
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [container.kind, container.id]);
  const since = awayFrom?.at ?? null;
  const arrived = since === null ? 0 : messages.filter((m) => m.author_id !== me.id && m.created_at > since).length;
  const jumpToLatest = useCallback(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[role="log"]');
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setAwayFrom(null);
  }, []);

  // The design's unread bar: everything from other people since the read marker.
  const unread = readMarker === null ? 0 : messages.filter((m) => m.author_id !== me.id && m.created_at > readMarker).length;

  const handleSend = useCallback(
    (content: JSONContent) => {
      send.mutate({ content, tempId: `temp-${crypto.randomUUID()}`, attachments: uploads.ready, previews: uploads.uploads });
      uploads.clear();
    },
    [send, uploads],
  );

  const handleSchedule = useCallback(
    (content: JSONContent, at: Date) => {
      void scheduleMessageAction({ container, content, sendAt: at.toISOString() }).then((result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Scheduled for ${describeWhen(at)}`, { description: "It'll be posted as you. Cancel it above the composer any time." });
        void queryClient.invalidateQueries({ queryKey: schedulingKeys.scheduled(container) });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [container.kind, container.id, queryClient],
  );

  return (
    <DropZone label={placeholder.replace(/^Message /, "")} onFiles={uploads.addFiles}>
      <div ref={listRef} className="relative flex min-h-0 flex-1 flex-col">
        {unread > 0 && readMarker && (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-accent-surface-border bg-accent-surface px-6 py-2">
            <span className="text-[12.5px] font-semibold text-accent-foreground">
              {unread} new {unread === 1 ? "message" : "messages"} since {formatMessageTime(readMarker, tz)}
            </span>
            <button
              type="button"
              onClick={markRead}
              className="ml-auto flex h-[26px] shrink-0 items-center rounded-[7px] border border-accent-surface-border bg-bg-card px-[9px] text-[12px] font-semibold text-ink hover:bg-bg-card-hover focus-visible:outline-2 focus-visible:outline-ring"
            >
              Mark as read
            </button>
          </div>
        )}
        <MessageList
          messages={messages}
          me={me}
          isAdmin={isAdmin}
          lastReadAt={readMarker}
          hasMore={Boolean(hasNextPage)}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
          onToggleReaction={(messageId, emoji, active) => toggleReaction.mutate({ messageId, emoji, active })}
          onDelete={(messageId) => del.mutate(messageId)}
          onEdit={(messageId, content) => edit.mutate({ messageId, content })}
          onTogglePin={(messageId, on) => pin.mutate({ messageId, on })}
          onToggleSave={(messageId, on) => save.mutate({ messageId, on })}
          allowBroadcast={container.kind === "channel"}
          onOpenThread={openThread}
          participants={participants ?? {}}
          highlightId={highlightId}
          startTitle={startTitle}
          startBody={startBody}
          startIcon={container.kind}
        />
        {awayFrom !== null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[4] flex justify-center">
            <button
              type="button"
              onClick={jumpToLatest}
              className="pointer-events-auto flex h-[34px] items-center gap-[9px] rounded-full border border-accent-border bg-primary pr-2 pl-3.5 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_-4px_var(--shadow-tint-lg),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-ring"
            >
              {arrived > 0 ? `${arrived} new ${arrived === 1 ? "message" : "messages"}` : "Jump to latest"}
              <span className="grid size-[22px] place-items-center rounded-full bg-white/20">
                <ChevronDown className="size-[13px]" aria-hidden="true" />
              </span>
            </button>
          </div>
        )}
      </div>
      <div className="shrink-0 px-6 pb-5">
        <TypingIndicator people={typing.others} />
        {canPost && <ScheduledNotice container={container} />}
        {canPost ? (
          <MessageComposer
            draftKey={`${container.kind}:${container.id}`}
            placeholder={placeholder}
            onSend={handleSend}
            onSchedule={handleSchedule}
            allowBroadcast={container.kind === "channel"}
            uploads={uploads}
            onTyping={typing.onKeystroke}
            onStopTyping={typing.stopTyping}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border-input bg-bg-chip px-4 py-3.5 text-[13px] text-fg-600">{readOnlyNotice}</div>
        )}
      </div>
    </DropZone>
  );
}

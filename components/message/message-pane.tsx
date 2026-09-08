"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import { markReadAction } from "@/lib/actions/messages";
import { MessageComposer } from "@/components/message/message-composer";
import { MessageList } from "@/components/message/message-list";
import { messageKeys, type Container, type MessageAuthor, type MessagePage } from "@/lib/queries/messages";
import { clearUnread } from "@/lib/queries/unreads";
import { useDeleteMessage, useMessages, useReplyParticipants, useSendMessage, useToggleReaction } from "@/lib/queries/use-messages";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

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
  const queryClient = useQueryClient();
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(container, initialPage);
  const send = useSendMessage(container, me);
  const { openThreadId, openThread } = useThreadNav();
  const keys = openThreadId ? [messageKeys.container(container), messageKeys.thread(openThreadId)] : [messageKeys.container(container)];
  const toggleReaction = useToggleReaction(keys, me.id);
  const del = useDeleteMessage(keys);
  const threaded = messages.filter((m) => m.reply_count > 0).map((m) => m.id);
  const { data: participants } = useReplyParticipants(container, threaded);

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

  const handleSend = useCallback(
    (content: JSONContent) => send.mutate({ content, tempId: `temp-${crypto.randomUUID()}` }),
    [send],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={messages}
        me={me}
        isAdmin={isAdmin}
        lastReadAt={lastReadAt}
        hasMore={Boolean(hasNextPage)}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        onToggleReaction={(messageId, emoji, active) => toggleReaction.mutate({ messageId, emoji, active })}
        onDelete={(messageId) => del.mutate(messageId)}
        onOpenThread={openThread}
        participants={participants ?? {}}
        startTitle={startTitle}
        startBody={startBody}
        startIcon={container.kind}
      />
      <div className="shrink-0 px-5 pb-5 pt-1">
        {canPost ? (
          <MessageComposer draftKey={`${container.kind}:${container.id}`} placeholder={placeholder} onSend={handleSend} />
        ) : (
          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-[13px]">{readOnlyNotice}</div>
        )}
      </div>
    </div>
  );
}

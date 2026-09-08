"use client";

import { useCallback, useEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import { markChannelReadAction } from "@/app/(app)/channel/[channelId]/actions";
import { MessageComposer } from "@/components/message/message-composer";
import { MessageList } from "@/components/message/message-list";
import type { ChannelRow } from "@/lib/queries/channel";
import type { MessageAuthor, MessagePage } from "@/lib/queries/messages";
import { useChannelMessages, useDeleteMessage, useSendMessage, useToggleReaction } from "@/lib/queries/use-messages";

export function ChannelView({
  channel,
  me,
  isAdmin,
  isMember,
  lastReadAt,
  initialPage,
}: {
  channel: ChannelRow;
  me: MessageAuthor;
  isAdmin: boolean;
  isMember: boolean;
  lastReadAt: string | null;
  initialPage: MessagePage;
}) {
  const { messages, fetchNextPage, hasNextPage, isFetchingNextPage } = useChannelMessages(channel.id, initialPage);
  const send = useSendMessage(channel.id, me);
  const toggleReaction = useToggleReaction(channel.id, me.id);
  const del = useDeleteMessage(channel.id);

  // Unread tracking (§5): mark read while the channel is visible and the window is focused.
  const latestAt = messages.length ? messages[messages.length - 1].created_at : null;
  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    if (!isMember) return;
    const mark = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (lastMarked.current === latestAt) return;
      lastMarked.current = latestAt;
      void markChannelReadAction({ channelId: channel.id });
    };
    mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
  }, [channel.id, isMember, latestAt]);

  const handleSend = useCallback(
    (content: JSONContent) => {
      send.mutate({ content, tempId: `temp-${crypto.randomUUID()}` });
    },
    [send],
  );

  return (
    <>
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
        channelName={channel.name}
      />
      <div className="shrink-0 px-5 pb-5 pt-1">
        {isMember ? (
          <MessageComposer draftKey={`channel:${channel.id}`} placeholder={`Message #${channel.name}`} onSend={handleSend} />
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3 text-[13px]">
            <span>You&apos;re previewing <strong>#{channel.name}</strong>. Join to post.</span>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeToChannelMessages } from "@/lib/realtime/messages";
import { toContentText } from "@/lib/utils/tiptap";
import { fetchChannelMessages, messageKeys, type Message, type MessageAuthor, type MessagePage } from "./messages";
import { deleteMessageAction, sendMessageAction, toggleReactionAction } from "@/app/(app)/channel/[channelId]/actions";

type Cache = InfiniteData<MessagePage, string | null>;

function patchCache(queryClient: ReturnType<typeof useQueryClient>, channelId: string, fn: (ms: Message[]) => Message[]) {
  queryClient.setQueryData<Cache>(messageKeys.channel(channelId), (old) =>
    old ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: fn(p.messages) })) } : old,
  );
}

/** Channel messages: server-rendered first page, older pages on demand, realtime patches. */
export function useChannelMessages(channelId: string, initialPage: MessagePage) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: messageKeys.channel(channelId),
    queryFn: ({ pageParam }) => fetchChannelMessages(getSupabaseBrowserClient(), channelId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initialPage], pageParams: [null] },
    staleTime: Infinity,
  });

  useEffect(() => {
    const channel = subscribeToChannelMessages(channelId, queryClient);
    return () => {
      void channel.unsubscribe();
    };
  }, [channelId, queryClient]);

  // pages[0] is newest; render oldest → newest.
  const messages = [...query.data.pages].reverse().flatMap((p) => p.messages);
  return { ...query, messages };
}

export function useSendMessage(channelId: string, me: MessageAuthor) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { content: JSONContent; tempId: string }) => sendMessageAction({ channelId, content: vars.content }),
    onMutate: async ({ content, tempId }) => {
      const now = new Date().toISOString();
      const optimistic: Message = {
        id: tempId,
        channel_id: channelId,
        conversation_id: null,
        author_id: me.id,
        parent_id: null,
        content: content as Message["content"],
        content_text: toContentText(content),
        search_vector: null,
        reply_count: 0,
        last_reply_at: null,
        is_edited: false,
        edited_at: null,
        deleted_at: null,
        created_at: now,
        author: me,
        reactions: [],
        attachments: [],
        pending: true,
      };
      patchCache(queryClient, channelId, (ms) => [...ms, optimistic]);
    },
    onSuccess: (result, { tempId }) => {
      if (!result.ok) throw new Error(result.error);
      const row = result.message;
      patchCache(queryClient, channelId, (ms) => {
        if (ms.some((m) => m.id === row.id)) return ms.filter((m) => m.id !== tempId);
        return ms.map((m) => (m.id === tempId ? { ...m, ...row, pending: false } : m));
      });
    },
    onError: (err, { tempId }) => {
      patchCache(queryClient, channelId, (ms) => ms.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error("Message didn't send", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

export function useToggleReaction(channelId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { messageId: string; emoji: string; active: boolean }) =>
      toggleReactionAction({ messageId: vars.messageId, emoji: vars.emoji, remove: vars.active }),
    onMutate: ({ messageId, emoji, active }) => {
      patchCache(queryClient, channelId, (ms) =>
        ms.map((m) => {
          if (m.id !== messageId) return m;
          return active
            ? { ...m, reactions: m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId)) }
            : { ...m, reactions: [...m.reactions, { emoji, user_id: userId }] };
        }),
      );
    },
    onSuccess: (result) => {
      if (!result.ok) throw new Error(result.error);
    },
    onError: (err, { messageId, emoji, active }) => {
      // Roll back to the previous state.
      patchCache(queryClient, channelId, (ms) =>
        ms.map((m) => {
          if (m.id !== messageId) return m;
          return active
            ? { ...m, reactions: [...m.reactions, { emoji, user_id: userId }] }
            : { ...m, reactions: m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId)) };
        }),
      );
      toast.error("Reaction didn't save", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

export function useDeleteMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => deleteMessageAction({ messageId }),
    onMutate: (messageId) => {
      const snapshot = queryClient.getQueryData<Cache>(messageKeys.channel(channelId));
      patchCache(queryClient, channelId, (ms) =>
        ms.map((m) => (m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m)),
      );
      return { snapshot };
    },
    onSuccess: (result) => {
      if (!result.ok) throw new Error(result.error);
    },
    onError: (err, _id, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(messageKeys.channel(channelId), ctx.snapshot);
      toast.error("Couldn't delete the message", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

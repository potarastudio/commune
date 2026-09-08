"use client";

import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/core";
import { deleteMessageAction, sendMessageAction, toggleReactionAction } from "@/lib/actions/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeToMessages } from "@/lib/realtime/messages";
import { toContentText } from "@/lib/utils/tiptap";
import { fetchMessages, messageKeys, type Container, type Message, type MessageAuthor, type MessagePage } from "./messages";

type Cache = InfiniteData<MessagePage, string | null>;

function patchCache(queryClient: QueryClient, container: Container, fn: (ms: Message[]) => Message[]) {
  queryClient.setQueryData<Cache>(messageKeys.container(container), (old) =>
    old ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: fn(p.messages) })) } : old,
  );
}

/** Messages for a container: server-rendered first page, older pages on demand, realtime patches. */
export function useMessages(container: Container, initialPage: MessagePage) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: messageKeys.container(container),
    queryFn: ({ pageParam }) => fetchMessages(getSupabaseBrowserClient(), container, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [initialPage], pageParams: [null] },
    staleTime: Infinity,
  });

  useEffect(
    () => subscribeToMessages(container, queryClient),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [container.kind, container.id, queryClient],
  );

  // pages[0] is newest; render oldest → newest.
  const messages = [...query.data.pages].reverse().flatMap((p) => p.messages);
  return { ...query, messages };
}

export function useSendMessage(container: Container, me: MessageAuthor) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { content: JSONContent; tempId: string }) => sendMessageAction({ container, content: vars.content }),
    onMutate: async ({ content, tempId }) => {
      const optimistic: Message = {
        id: tempId,
        channel_id: container.kind === "channel" ? container.id : null,
        conversation_id: container.kind === "conversation" ? container.id : null,
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
        created_at: new Date().toISOString(),
        author: me,
        reactions: [],
        attachments: [],
        pending: true,
      };
      patchCache(queryClient, container, (ms) => [...ms, optimistic]);
    },
    onSuccess: (result, { tempId }) => {
      if (!result.ok) throw new Error(result.error);
      const row = result.message;
      patchCache(queryClient, container, (ms) => {
        if (ms.some((m) => m.id === row.id)) return ms.filter((m) => m.id !== tempId);
        return ms.map((m) => (m.id === tempId ? { ...m, ...row, pending: false } : m));
      });
    },
    onError: (err, { tempId }) => {
      patchCache(queryClient, container, (ms) => ms.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error("Message didn't send", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

export function useToggleReaction(container: Container, userId: string) {
  const queryClient = useQueryClient();
  const apply = (messageId: string, emoji: string, add: boolean) =>
    patchCache(queryClient, container, (ms) =>
      ms.map((m) => {
        if (m.id !== messageId) return m;
        return add
          ? { ...m, reactions: [...m.reactions, { emoji, user_id: userId }] }
          : { ...m, reactions: m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId)) };
      }),
    );

  return useMutation({
    mutationFn: async (vars: { messageId: string; emoji: string; active: boolean }) =>
      toggleReactionAction({ messageId: vars.messageId, emoji: vars.emoji, remove: vars.active }),
    onMutate: ({ messageId, emoji, active }) => apply(messageId, emoji, !active),
    onSuccess: (result) => {
      if (!result.ok) throw new Error(result.error);
    },
    onError: (err, { messageId, emoji, active }) => {
      apply(messageId, emoji, active);
      toast.error("Reaction didn't save", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

export function useDeleteMessage(container: Container) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => deleteMessageAction({ messageId }),
    onMutate: (messageId) => {
      const snapshot = queryClient.getQueryData<Cache>(messageKeys.container(container));
      patchCache(queryClient, container, (ms) =>
        ms.map((m) => (m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m)),
      );
      return { snapshot };
    },
    onSuccess: (result) => {
      if (!result.ok) throw new Error(result.error);
    },
    onError: (err, _id, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(messageKeys.container(container), ctx.snapshot);
      toast.error("Couldn't delete the message", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/core";
import { deleteMessageAction, sendMessageAction, sendReplyAction, toggleReactionAction } from "@/lib/actions/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeToMessages, subscribeToThread } from "@/lib/realtime/messages";
import { toContentText } from "@/lib/utils/tiptap";
import { patchMessages } from "./message-cache";
import type { PendingUpload } from "./use-uploads";
import {
  fetchMessageById,
  fetchMessages,
  fetchReplyParticipants,
  fetchThread,
  messageKeys,
  type AttachmentInput,
  type Container,
  type Message,
  type MessageAuthor,
  type MessagePage,
} from "./messages";

export type SendVars = { content: JSONContent; tempId: string; attachments: AttachmentInput[]; previews: PendingUpload[] };

/** Swap the optimistic row for the confirmed one, with real attachment rows, then drop local previews. */
async function confirmSent(queryClient: ReturnType<typeof useQueryClient>, key: MessageKey, tempId: string, rowId: string, vars: SendVars) {
  const full = vars.attachments.length ? await fetchMessageById(getSupabaseBrowserClient(), rowId) : null;
  patchMessages(queryClient, key, (ms) => {
    const already = ms.some((m) => m.id === rowId);
    return ms.flatMap((m) => {
      if (m.id === tempId) return already ? [] : [full ? { ...full, pending: false } : { ...m, id: rowId, pending: false }];
      if (m.id === rowId && full) return [{ ...full, pending: false }];
      return [m];
    });
  });
  for (const p of vars.previews) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
}

function optimisticAttachments(vars: SendVars, messageId: string): Message["attachments"] {
  return vars.attachments.map((a, i) => ({
    id: `${messageId}-att-${i}`,
    message_id: messageId,
    storage_path: a.storage_path,
    file_name: a.file_name,
    mime_type: a.mime_type,
    size_bytes: a.size_bytes,
    width: a.width,
    height: a.height,
    created_at: new Date().toISOString(),
    preview_url: vars.previews.find((p) => p.result?.storage_path === a.storage_path)?.previewUrl ?? undefined,
  }));
}

type MessageKey = readonly unknown[];

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

/** The open thread: parent + replies, with its own realtime feed. */
export function useThread(parentId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: messageKeys.thread(parentId),
    queryFn: () => fetchThread(getSupabaseBrowserClient(), parentId),
    staleTime: Infinity,
  });
  useEffect(() => subscribeToThread(parentId, queryClient), [parentId, queryClient]);
  return query;
}

/** Reply author ids per parent, for the avatar row under threaded messages. */
export function useReplyParticipants(container: Container, parentIds: string[]) {
  const ids = [...parentIds].sort();
  return useQuery({
    queryKey: [...messageKeys.participants(container), ids.join(",")],
    queryFn: () => fetchReplyParticipants(getSupabaseBrowserClient(), ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

function optimisticMessage(
  container: Container,
  me: MessageAuthor,
  content: JSONContent,
  tempId: string,
  parentId: string | null,
  attachments: Message["attachments"] = [],
): Message {
  return {
    id: tempId,
    channel_id: container.kind === "channel" ? container.id : null,
    conversation_id: container.kind === "conversation" ? container.id : null,
    author_id: me.id,
    parent_id: parentId,
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
    attachments,
    pending: true,
  };
}

export function useSendMessage(container: Container, me: MessageAuthor) {
  const queryClient = useQueryClient();
  const key = messageKeys.container(container);

  return useMutation({
    mutationFn: async (vars: SendVars) => sendMessageAction({ container, content: vars.content, attachments: vars.attachments }),
    onMutate: (vars) =>
      patchMessages(queryClient, key, (ms) => [
        ...ms,
        optimisticMessage(container, me, vars.content, vars.tempId, null, optimisticAttachments(vars, vars.tempId)),
      ]),
    onSuccess: async (result, vars) => {
      if (!result.ok) throw new Error(result.error);
      const row = result.message;
      patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === vars.tempId ? { ...m, ...row, id: vars.tempId } : m)));
      await confirmSent(queryClient, key, vars.tempId, row.id, vars);
    },
    onError: (err, { tempId }) => {
      patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error("Message didn't send", { description: "It stays here so you can copy it. Try again in a moment." });
      console.error("sendMessage", err);
    },
  });
}

export function useSendReply(container: Container, parentId: string, me: MessageAuthor) {
  const queryClient = useQueryClient();
  const key = messageKeys.thread(parentId);

  return useMutation({
    mutationFn: async (vars: SendVars & { alsoSendToContainer: boolean }) =>
      sendReplyAction({
        container,
        parentId,
        content: vars.content,
        alsoSendToContainer: vars.alsoSendToContainer,
        attachments: vars.attachments,
      }),
    onMutate: (vars) =>
      patchMessages(queryClient, key, (ms) => [
        ...ms,
        optimisticMessage(container, me, vars.content, vars.tempId, parentId, optimisticAttachments(vars, vars.tempId)),
      ]),
    onSuccess: async (result, vars) => {
      if (!result.ok) throw new Error(result.error);
      const row = result.message;
      patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === vars.tempId ? { ...m, ...row, id: vars.tempId } : m)));
      await confirmSent(queryClient, key, vars.tempId, row.id, vars);
    },
    onError: (err, { tempId }) => {
      patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast.error("Reply didn't send", { description: "It stays here so you can copy it. Try again in a moment." });
      console.error("sendReply", err);
    },
  });
}

/** Reactions, optimistic. `keys` are every cache that may hold the message (list and open thread). */
export function useToggleReaction(keys: MessageKey[], userId: string) {
  const queryClient = useQueryClient();
  const apply = (messageId: string, emoji: string, add: boolean) => {
    for (const key of keys) {
      patchMessages(queryClient, key, (ms) =>
        ms.map((m) => {
          if (m.id !== messageId) return m;
          const has = m.reactions.some((r) => r.emoji === emoji && r.user_id === userId);
          if (add) return has ? m : { ...m, reactions: [...m.reactions, { emoji, user_id: userId }] };
          return { ...m, reactions: m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId)) };
        }),
      );
    }
  };

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

export function useDeleteMessage(keys: MessageKey[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => deleteMessageAction({ messageId }),
    onMutate: (messageId) => {
      const snapshots = keys.map((key) => [key, queryClient.getQueryData(key)] as const);
      const now = new Date().toISOString();
      for (const key of keys) patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === messageId ? { ...m, deleted_at: now } : m)));
      return { snapshots };
    },
    onSuccess: (result) => {
      if (!result.ok) throw new Error(result.error);
    },
    onError: (err, _id, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) queryClient.setQueryData(key, data);
      toast.error("Couldn't delete the message", { description: err instanceof Error ? err.message : "Try again." });
    },
  });
}

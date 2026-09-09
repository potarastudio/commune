import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  containerColumn,
  fetchMessageById,
  messageKeys,
  type Container,
  type MessageRow,
  type Reaction,
} from "@/lib/queries/messages";
import { appendMessage, patchMessages } from "@/lib/queries/message-cache";
import { invalidateFiles } from "@/lib/queries/files";

type ReactionRow = Reaction & { message_id: string };
type PinRow = { message_id: string; pinned_by: string | null };

function pinPatcher(queryClient: QueryClient, key: readonly unknown[]) {
  return (payload: RealtimePostgresChangesPayload<PinRow>) => {
    const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<PinRow>;
    if (!row.message_id) return;
    const on = payload.eventType !== "DELETE";
    patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === row.message_id ? { ...m, is_pinned: on } : m)));
  };
}

/**
 * Realtime needs the user's JWT so RLS applies to the change feed. The browser
 * client loads the session from cookies asynchronously, so wait for it before
 * subscribing; otherwise the channel would be authorised as `anon` and see nothing.
 */
export function subscribeWithAuth(
  supabase: SupabaseClient,
  topic: string,
  configure: (channel: RealtimeChannel) => RealtimeChannel,
  label = topic,
): () => void {
  let channel: RealtimeChannel | undefined;
  let cancelled = false;
  void (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (cancelled) return;
    if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
    if (cancelled) return;
    // Change feeds never need a shared topic name, and supabase-js reuses one
    // channel object per name, so every subscriber gets its own.
    const nonce = Math.random().toString(36).slice(2, 8);
    channel = configure(supabase.channel(`${topic}:${nonce}`)).subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`realtime ${label}: ${status}`, err?.message);
      }
    });
  })();
  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

function reactionPatcher(queryClient: QueryClient, key: readonly unknown[]) {
  return (payload: RealtimePostgresChangesPayload<ReactionRow>) => {
    const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<ReactionRow>;
    if (!row.message_id || !row.emoji || !row.user_id) return;
    const { message_id, emoji, user_id } = row;
    patchMessages(queryClient, key, (ms) =>
      ms.map((m) => {
        if (m.id !== message_id) return m;
        const has = m.reactions.some((r) => r.emoji === emoji && r.user_id === user_id);
        if (payload.eventType === "DELETE") {
          return has ? { ...m, reactions: m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === user_id)) } : m;
        }
        return has ? m : { ...m, reactions: [...m.reactions, { emoji, user_id }] };
      }),
    );
  };
}

/**
 * Postgres Changes for the open container (§7): patch the TanStack cache in
 * place, never refetch the list. Reactions are subscribed table-wide (the team
 * is small) and applied only when the message is in this cache.
 */
export function subscribeToMessages(container: Container, queryClient: QueryClient): () => void {
  const supabase = getSupabaseBrowserClient();
  const key = messageKeys.container(container);

  const onMessage = async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
    if (payload.eventType === "DELETE") {
      const id = (payload.old as Partial<MessageRow>).id;
      if (id) patchMessages(queryClient, key, (ms) => ms.filter((m) => m.id !== id));
      return;
    }
    const row = payload.new;
    if (row.parent_id) {
      // A reply somewhere in this container: the avatar row under its parent may change.
      void queryClient.invalidateQueries({ queryKey: messageKeys.participants(container) });
      return;
    }
    if (payload.eventType === "UPDATE") {
      patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      return;
    }
    const full = await fetchMessageById(supabase, row.id);
    if (full) {
      appendMessage(queryClient, key, full);
      if (full.attachments.length) invalidateFiles(queryClient, container);
    }
  };

  return subscribeWithAuth(
    supabase,
    `${container.kind}:${container.id}:messages`,
    (channel) =>
      channel
        .on<MessageRow>(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `${containerColumn(container)}=eq.${container.id}` },
          onMessage,
        )
        .on<ReactionRow>("postgres_changes", { event: "*", schema: "public", table: "reactions" }, reactionPatcher(queryClient, key))
        .on<PinRow>("postgres_changes", { event: "*", schema: "public", table: "pins" }, (payload) => {
          pinPatcher(queryClient, key)(payload);
          pinPatcher(queryClient, messageKeys.pins(container))(payload);
          if (payload.eventType === "INSERT") void queryClient.invalidateQueries({ queryKey: messageKeys.pins(container) });
          else {
            const id = (payload.old as Partial<PinRow>).message_id;
            if (id) patchMessages(queryClient, messageKeys.pins(container), (ms) => ms.filter((m) => m.id !== id));
          }
        }),
    `${container.kind}:${container.id}`,
  );
}

/** Replies to one parent, for the open thread panel. */
export function subscribeToThread(parentId: string, queryClient: QueryClient): () => void {
  const supabase = getSupabaseBrowserClient();
  const key = messageKeys.thread(parentId);

  const onReply = async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
    if (payload.eventType === "DELETE") {
      const id = (payload.old as Partial<MessageRow>).id;
      if (id) patchMessages(queryClient, key, (ms) => ms.filter((m) => m.id !== id));
      return;
    }
    const row = payload.new;
    if (payload.eventType === "UPDATE") {
      patchMessages(queryClient, key, (ms) => ms.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      return;
    }
    const full = await fetchMessageById(supabase, row.id);
    if (full) appendMessage(queryClient, key, full);
  };

  return subscribeWithAuth(
    supabase,
    `thread:${parentId}`,
    (channel) =>
      channel
        .on<MessageRow>(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `parent_id=eq.${parentId}` },
          onReply,
        )
        .on<ReactionRow>("postgres_changes", { event: "*", schema: "public", table: "reactions" }, reactionPatcher(queryClient, key))
        .on<PinRow>("postgres_changes", { event: "*", schema: "public", table: "pins" }, pinPatcher(queryClient, key)),
    `thread:${parentId}`,
  );
}

import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient, InfiniteData } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  containerColumn,
  fetchMessageById,
  messageKeys,
  type Container,
  type Message,
  type MessagePage,
  type MessageRow,
  type Reaction,
} from "@/lib/queries/messages";

type Cache = InfiniteData<MessagePage, string | null>;
type ReactionRow = Reaction & { message_id: string };

/**
 * Realtime needs the user's JWT so RLS applies to the change feed. The browser
 * client loads the session from cookies asynchronously, so wait for it before
 * subscribing; otherwise the channel would be authorised as `anon` and see nothing.
 */
export function subscribeWithAuth(
  supabase: SupabaseClient,
  build: () => RealtimeChannel,
  label: string,
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
    channel = build().subscribe((status, err) => {
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

/**
 * Postgres Changes for the open container (§7): patch the TanStack cache in
 * place, never refetch the list. Reactions are subscribed table-wide (the team
 * is small) and applied only when the message is in this cache.
 */
export function subscribeToMessages(container: Container, queryClient: QueryClient): () => void {
  const supabase = getSupabaseBrowserClient();
  const key = messageKeys.container(container);

  const patch = (fn: (messages: Message[]) => Message[]) => {
    queryClient.setQueryData<Cache>(key, (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: fn(p.messages) })) } : old,
    );
  };

  const onMessage = async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
    if (payload.eventType === "DELETE") {
      const id = (payload.old as Partial<MessageRow>).id;
      if (id) patch((ms) => ms.filter((m) => m.id !== id));
      return;
    }
    const row = payload.new;
    if (row.parent_id) return; // thread replies live in the thread panel

    if (payload.eventType === "UPDATE") {
      patch((ms) => ms.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      return;
    }

    // INSERT: fetch with author + relations, then append (or replace an optimistic twin).
    const full = await fetchMessageById(supabase, row.id);
    if (!full) return;
    queryClient.setQueryData<Cache>(key, (old) => {
      if (!old) return old;
      if (old.pages.some((p) => p.messages.some((m) => m.id === full.id))) return old;
      const pages = old.pages.map((p, i) => {
        if (i !== 0) return p;
        const withoutTwin = p.messages.filter(
          (m) => !(m.pending && m.author_id === full.author_id && m.content_text === full.content_text),
        );
        return { ...p, messages: [...withoutTwin, full] };
      });
      return { ...old, pages };
    });
  };

  const onReaction = (payload: RealtimePostgresChangesPayload<ReactionRow>) => {
    const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<ReactionRow>;
    if (!row.message_id || !row.emoji || !row.user_id) return;
    const { message_id, emoji, user_id } = row;
    patch((ms) =>
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

  return subscribeWithAuth(
    supabase,
    () =>
      supabase
        .channel(`${container.kind}:${container.id}:messages`)
        .on<MessageRow>(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `${containerColumn(container)}=eq.${container.id}` },
          onMessage,
        )
        .on<ReactionRow>("postgres_changes", { event: "*", schema: "public", table: "reactions" }, onReaction),
    `${container.kind}:${container.id}`,
  );
}

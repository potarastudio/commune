import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { PAGE_SIZE, beforeCursorFilter, decodeCursor, nextCursorFromPage } from "@/lib/utils/pagination";
import type { Profile } from "./profile";

/**
 * Message reads and writes for channels and conversations. Shared by Server
 * Components (initial page), client hooks (older pages, realtime patches) and
 * Server Actions (writes). No component talks to Supabase directly (§3).
 */

type Supabase = SupabaseClient<Database>;

/** Where a message lives: a channel or a DM/group DM. */
export type Container = { kind: "channel"; id: string } | { kind: "conversation"; id: string };

export function containerColumn(c: Container): "channel_id" | "conversation_id" {
  return c.kind === "channel" ? "channel_id" : "conversation_id";
}

export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];
export type MessageAuthor = Pick<Profile, "id" | "display_name" | "handle" | "avatar_url">;
export type Reaction = { emoji: string; user_id: string };

export type Message = MessageRow & {
  author: MessageAuthor | null;
  reactions: Reaction[];
  attachments: AttachmentRow[];
  /** Client-only: optimistic message not yet confirmed by the server. */
  pending?: boolean;
  /** Client-only: the send failed; the row stays so the user can retry or copy. */
  failed?: boolean;
};

export type MessagePage = { messages: Message[]; nextCursor: string | null };

export const MESSAGE_SELECT =
  "*, author:profiles!messages_author_id_fkey(id, display_name, handle, avatar_url), reactions(emoji, user_id), attachments(*)";

export type Thread = { parent: Message; replies: Message[] };

export const messageKeys = {
  container: (c: Container) => ["messages", c.kind, c.id] as const,
  thread: (parentId: string) => ["thread", parentId] as const,
  participants: (c: Container) => ["thread-participants", c.kind, c.id] as const,
};

function normalise(row: unknown): Message {
  const r = row as Omit<Message, "reactions" | "attachments"> & {
    reactions: Reaction[] | null;
    attachments: AttachmentRow[] | null;
  };
  return { ...r, reactions: r.reactions ?? [], attachments: r.attachments ?? [] };
}

/** One page of top-level messages, ascending; the newest page comes first. */
export async function fetchMessages(supabase: Supabase, container: Container, before: string | null = null): Promise<MessagePage> {
  let q = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq(containerColumn(container), container.id)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  const cursor = decodeCursor(before);
  if (cursor) q = q.or(beforeCursorFilter(cursor));

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const messages = data.map(normalise).reverse();
  return { messages, nextCursor: nextCursorFromPage(messages) };
}

export async function fetchMessageById(supabase: Supabase, id: string): Promise<Message | null> {
  const { data, error } = await supabase.from("messages").select(MESSAGE_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalise(data) : null;
}

/** A thread: the parent plus every reply, oldest first. Threads are short, so no paging yet. */
export async function fetchThread(supabase: Supabase, parentId: string): Promise<Thread | null> {
  const [parent, replies] = await Promise.all([
    fetchMessageById(supabase, parentId),
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("parent_id", parentId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(500),
  ]);
  if (replies.error) throw new Error(replies.error.message);
  if (!parent) return null;
  return { parent, replies: replies.data.map(normalise) };
}

/** Who has replied in each thread, for the avatar row under a parent. */
export async function fetchReplyParticipants(supabase: Supabase, parentIds: string[]): Promise<Record<string, string[]>> {
  if (parentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("messages")
    .select("parent_id, author_id, created_at")
    .in("parent_id", parentIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const out: Record<string, string[]> = {};
  for (const row of data) {
    if (!row.parent_id) continue;
    const list = (out[row.parent_id] ??= []);
    if (!list.includes(row.author_id)) list.push(row.author_id);
  }
  return out;
}

export async function insertMessage(
  supabase: Supabase,
  input: {
    container: Container;
    content: Record<string, unknown>;
    contentText: string;
    parentId?: string | null;
    alsoSendToContainer?: boolean;
  },
): Promise<MessageRow> {
  const { data, error } = await supabase.rpc("insert_message", {
    p_content: input.content as Json,
    p_channel_id: input.container.kind === "channel" ? input.container.id : undefined,
    p_conversation_id: input.container.kind === "conversation" ? input.container.id : undefined,
    p_content_text: input.contentText,
    p_parent_id: input.parentId ?? undefined,
    p_also_send_to_container: input.alsoSendToContainer ?? false,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function addReaction(supabase: Supabase, messageId: string, userId: string, emoji: string) {
  const { error } = await supabase.from("reactions").insert({ message_id: messageId, user_id: userId, emoji });
  if (error && error.code !== "23505") throw new Error(error.message); // already reacted: fine
}

export async function removeReaction(supabase: Supabase, messageId: string, userId: string, emoji: string) {
  const { error } = await supabase
    .from("reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji);
  if (error) throw new Error(error.message);
}

export async function softDeleteMessage(supabase: Supabase, messageId: string) {
  const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw new Error(error.message);
}

export async function markRead(supabase: Supabase, container: Container) {
  const { error } = await supabase.rpc("mark_read", {
    p_channel_id: container.kind === "channel" ? container.id : undefined,
    p_conversation_id: container.kind === "conversation" ? container.id : undefined,
  });
  if (error) throw new Error(error.message);
}

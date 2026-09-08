import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MessageAuthor, MessageRow } from "./messages";

type Supabase = SupabaseClient<Database>;

type ContainerRef = { channel: { id: string; name: string } | null; conversation: { id: string } | null };

export type MentionActivity = {
  id: string;
  kind: "user" | "channel" | "here";
  created_at: string;
  message: Pick<MessageRow, "id" | "content" | "content_text" | "parent_id" | "created_at" | "deleted_at"> & {
    author: MessageAuthor | null;
  } & ContainerRef;
};

export type ReactionActivity = {
  emoji: string;
  created_at: string;
  reactor: MessageAuthor | null;
  message: Pick<MessageRow, "id" | "content_text" | "parent_id" | "created_at"> & ContainerRef;
};

const MESSAGE_REF =
  "id, content, content_text, parent_id, created_at, deleted_at, author:profiles!messages_author_id_fkey(id, display_name, handle, avatar_url), channel:channels(id, name), conversation:conversations(id)";

/** Messages that mention me directly, or @channel/@here in channels I can read. RLS hides the rest. */
export async function getMentionsOfMe(supabase: Supabase, meId: string, limit = 50): Promise<MentionActivity[]> {
  const { data, error } = await supabase
    .from("mentions")
    .select(`id, kind, created_at, message:messages!inner(${MESSAGE_REF})`)
    .or(`user_id.eq.${meId},kind.in.(channel,here)`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as MentionActivity[])
    .filter((m) => m.message && m.message.author?.id !== meId && !m.message.deleted_at)
    .sort((a, b) => b.message.created_at.localeCompare(a.message.created_at));
}

/** Reactions other people left on my messages. */
export async function getReactionsOnMyMessages(supabase: Supabase, meId: string, limit = 50): Promise<ReactionActivity[]> {
  const { data, error } = await supabase
    .from("reactions")
    .select(
      "emoji, created_at, reactor:profiles!reactions_user_id_fkey(id, display_name, handle, avatar_url), message:messages!inner(id, content_text, parent_id, created_at, author_id, channel:channels(id, name), conversation:conversations(id))",
    )
    .eq("message.author_id", meId)
    .neq("user_id", meId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as ReactionActivity[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Link to a message in its container, opening the thread when it is a reply. */
export function messageHref(m: { id: string; parent_id: string | null } & ContainerRef): string {
  const base = m.channel ? `/channel/${m.channel.id}` : m.conversation ? `/dm/${m.conversation.id}` : "/";
  return m.parent_id ? `${base}?thread=${m.parent_id}` : `${base}?message=${m.id}`;
}

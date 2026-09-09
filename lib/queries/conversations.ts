import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Profile } from "./profile";

type Supabase = SupabaseClient<Database>;

export type ConversationMember = Pick<Profile, "id" | "display_name" | "handle" | "avatar_url" | "title">;

export type ConversationSummary = {
  id: string;
  created_at: string;
  members: ConversationMember[];
  last_message_at: string | null;
};

const SUMMARY_SELECT =
  "id, created_at, conversation_members(profiles!conversation_members_user_id_fkey(id, display_name, handle, avatar_url, title)), messages(created_at)";

type SummaryRow = {
  id: string;
  created_at: string;
  conversation_members: { profiles: ConversationMember | null }[];
  messages: { created_at: string }[];
};

function toSummary(row: SummaryRow): ConversationSummary {
  return {
    id: row.id,
    created_at: row.created_at,
    members: row.conversation_members.map((m) => m.profiles).filter((p): p is ConversationMember => p !== null),
    last_message_at: row.messages[0]?.created_at ?? null,
  };
}

/** The user's DMs and group DMs, most recently active first. RLS limits rows to their own. */
export async function getMyConversations(supabase: Supabase): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(SUMMARY_SELECT)
    .is("messages.parent_id", null)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });
  if (error) throw new Error(error.message);
  return (data as unknown as SummaryRow[])
    .map(toSummary)
    .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
}

export async function getConversation(supabase: Supabase, id: string): Promise<ConversationSummary | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(SUMMARY_SELECT)
    .eq("id", id)
    .is("messages.parent_id", null)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" })
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSummary(data as unknown as SummaryRow) : null;
}

export async function getOrCreateConversation(supabase: Supabase, userIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_conversation", { user_ids: userIds });
  if (error) throw new Error(error.message);
  return data;
}

/** "Sari Wijaya" for a DM, "Sari, Raka" for a group, "You" for notes to self. */
export function conversationLabel(members: ConversationMember[], meId: string, opts: { short?: boolean } = {}): string {
  const others = members.filter((m) => m.id !== meId);
  if (others.length === 0) return "You";
  if (others.length === 1) return others[0].display_name;
  return others.map((m) => (opts.short ? m.display_name.split(" ")[0] : m.display_name)).join(", ");
}

export function conversationMembership(supabase: Supabase, conversationId: string, userId: string) {
  return supabase
    .from("conversation_members")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
}

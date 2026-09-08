import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ParsedSearch } from "@/lib/utils/search-query";
import type { MessageAuthor, MessageRow } from "./messages";

type Supabase = SupabaseClient<Database>;

export type SearchResult = Pick<MessageRow, "id" | "content_text" | "parent_id" | "created_at"> & {
  author: MessageAuthor | null;
  channel: { id: string; name: string } | null;
  conversation: { id: string } | null;
};

export type SearchOutcome =
  | { ok: true; results: SearchResult[]; unresolved: null }
  | { ok: false; results: []; unresolved: string };

/**
 * Full-text search through public.search_messages (RLS applies, invoker).
 * Resolves `from:@handle` and `in:#channel` to ids first; an unknown one is
 * reported instead of silently searching everything.
 */
export async function searchMessages(supabase: Supabase, query: ParsedSearch, limit = 50): Promise<SearchOutcome> {
  let fromId: string | null = null;
  let channelId: string | null = null;

  if (query.from) {
    const { data } = await supabase.from("profiles").select("id").eq("handle", query.from).maybeSingle();
    if (!data) return { ok: false, results: [], unresolved: `Nobody has the handle @${query.from}.` };
    fromId = data.id;
  }
  if (query.in) {
    const { data } = await supabase.from("channels").select("id").eq("name", query.in).maybeSingle();
    if (!data) return { ok: false, results: [], unresolved: `There is no #${query.in} you can see.` };
    channelId = data.id;
  }

  const { data: rows, error } = await supabase.rpc("search_messages", {
    p_query: query.terms,
    p_from: fromId ?? undefined,
    p_in_channel: channelId ?? undefined,
    p_before: query.before ? `${query.before}T00:00:00Z` : undefined,
    p_after: query.after ? `${query.after}T23:59:59Z` : undefined,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  if (rows.length === 0) return { ok: true, results: [], unresolved: null };

  // Second pass for display data; keeps the SQL function's ranking order.
  const ids = rows.map((r) => r.id);
  const { data: detailed, error: dErr } = await supabase
    .from("messages")
    .select(
      "id, content_text, parent_id, created_at, author:profiles!messages_author_id_fkey(id, display_name, handle, avatar_url), channel:channels(id, name), conversation:conversations(id)",
    )
    .in("id", ids);
  if (dErr) throw new Error(dErr.message);

  const byId = new Map((detailed as unknown as SearchResult[]).map((r) => [r.id, r]));
  return { ok: true, results: ids.map((id) => byId.get(id)).filter((r): r is SearchResult => Boolean(r)), unresolved: null };
}

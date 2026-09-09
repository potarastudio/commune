import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Bookmark = Database["public"]["Tables"]["channel_bookmarks"]["Row"];

export const bookmarkKeys = { channel: (channelId: string) => ["bookmarks", channelId] as const };

/** A channel's bookmarks in bar order. Works with the server and browser clients. */
export async function fetchBookmarks(supabase: SupabaseClient<Database>, channelId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from("channel_bookmarks")
    .select("*")
    .eq("channel_id", channelId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

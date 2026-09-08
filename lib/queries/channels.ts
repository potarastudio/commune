import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];

/** Channels the current user has joined, for the sidebar. Server-side. */
export async function getJoinedChannels(supabase: SupabaseServerClient, userId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from("channel_members")
    .select("channels(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);

  return data
    .map((row) => row.channels)
    .filter((c): c is Channel => c !== null && !c.is_archived)
    .sort((a, b) => (a.name === "general" ? -1 : b.name === "general" ? 1 : a.name.localeCompare(b.name)));
}

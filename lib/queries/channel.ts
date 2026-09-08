import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type ChannelMembership = Database["public"]["Tables"]["channel_members"]["Row"];

export async function getChannel(supabase: SupabaseServerClient, channelId: string): Promise<ChannelRow | null> {
  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMembership(
  supabase: SupabaseServerClient,
  channelId: string,
  userId: string,
): Promise<ChannelMembership | null> {
  const { data, error } = await supabase
    .from("channel_members")
    .select("*")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMemberCount(supabase: SupabaseServerClient, channelId: string): Promise<number> {
  const { count, error } = await supabase
    .from("channel_members")
    .select("user_id", { count: "exact", head: true })
    .eq("channel_id", channelId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getGeneralChannelId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data, error } = await supabase.from("channels").select("id").eq("name", "general").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

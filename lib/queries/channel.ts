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

export type BrowseChannel = ChannelRow & { member_count: number; joined: boolean };

/** Channels visible to the user (RLS: public + private they belong to), with counts and joined state. */
export async function getChannelsForBrowse(supabase: SupabaseServerClient, userId: string): Promise<BrowseChannel[]> {
  const [{ data: channels, error }, { data: mine, error: mErr }] = await Promise.all([
    supabase.from("channels").select("*, channel_members(count)").order("name"),
    supabase.from("channel_members").select("channel_id").eq("user_id", userId),
  ]);
  if (error) throw new Error(error.message);
  if (mErr) throw new Error(mErr.message);
  const joined = new Set(mine.map((m) => m.channel_id));
  return channels.map((c) => {
    const { channel_members, ...row } = c as ChannelRow & { channel_members: { count: number }[] };
    return { ...row, member_count: channel_members[0]?.count ?? 0, joined: joined.has(row.id) };
  });
}

export type ChannelMember = { id: string; display_name: string; handle: string; avatar_url: string | null; title: string | null };

export async function getChannelMembers(supabase: SupabaseServerClient, channelId: string): Promise<ChannelMember[]> {
  const { data, error } = await supabase
    .from("channel_members")
    .select("profiles!channel_members_user_id_fkey(id, display_name, handle, avatar_url, title)")
    .eq("channel_id", channelId);
  if (error) throw new Error(error.message);
  return data
    .map((r) => r.profiles)
    .filter((p): p is ChannelMember => p !== null)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

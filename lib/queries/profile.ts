import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** The signed-in user's profile, or null when signed out. Server-side only. */
export async function getCurrentProfile(supabase: SupabaseServerClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** One member by @handle, for their profile page. Null when nobody has it. */
export async function getProfileByHandle(supabase: SupabaseServerClient, handle: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type SharedChannel = { id: string; name: string; is_private: boolean; mutual: boolean };

/**
 * Channels this person is in that the viewer can see. RLS already hides private
 * channels the viewer is not in, so what comes back is exactly what they may
 * know about. `mutual` marks the ones the viewer is in too.
 */
export async function getVisibleChannelsFor(
  supabase: SupabaseServerClient,
  userId: string,
  viewerId: string,
): Promise<SharedChannel[]> {
  const [theirs, mine] = await Promise.all([
    supabase.from("channel_members").select("channels(id, name, is_private, is_archived)").eq("user_id", userId),
    supabase.from("channel_members").select("channel_id").eq("user_id", viewerId),
  ]);
  if (theirs.error) throw new Error(theirs.error.message);
  if (mine.error) throw new Error(mine.error.message);

  const mineIds = new Set(mine.data.map((r) => r.channel_id));
  return theirs.data
    .flatMap((r) => (r.channels && !r.channels.is_archived ? [r.channels] : []))
    .map((c) => ({ id: c.id, name: c.name, is_private: c.is_private, mutual: mineIds.has(c.id) }))
    .sort((a, b) => Number(b.mutual) - Number(a.mutual) || a.name.localeCompare(b.name));
}

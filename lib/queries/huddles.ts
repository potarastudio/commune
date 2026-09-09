import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Container } from "./messages";

type Supabase = SupabaseClient<Database>;

export type HuddleRow = Database["public"]["Tables"]["huddles"]["Row"];
export type HuddleParticipant = { id: string; display_name: string; handle: string; avatar_url: string | null; joined_at: string };

export type ActiveHuddle = HuddleRow & {
  starter: { id: string; display_name: string } | null;
  participants: HuddleParticipant[];
};

export const huddleKeys = {
  container: (c: Container) => ["huddle", c.kind, c.id] as const,
};

const SELECT =
  "*, starter:profiles!huddles_started_by_fkey(id, display_name), huddle_participants(user_id, joined_at, left_at, profile:profiles!huddle_participants_user_id_fkey(id, display_name, handle, avatar_url))";

type Row = HuddleRow & {
  starter: { id: string; display_name: string } | null;
  huddle_participants: { user_id: string; joined_at: string; left_at: string | null; profile: Omit<HuddleParticipant, "joined_at"> | null }[];
};

function shape(row: Row): ActiveHuddle {
  const { huddle_participants, ...rest } = row;
  const latest = new Map<string, HuddleParticipant>();
  for (const p of huddle_participants) {
    if (p.left_at || !p.profile) continue;
    const prev = latest.get(p.user_id);
    if (!prev || prev.joined_at < p.joined_at) latest.set(p.user_id, { ...p.profile, joined_at: p.joined_at });
  }
  return { ...rest, participants: [...latest.values()].sort((a, b) => a.joined_at.localeCompare(b.joined_at)) };
}

/** The live huddle in a container, if any. RLS limits this to containers the user can read. */
export async function getActiveHuddle(supabase: Supabase, container: Container): Promise<ActiveHuddle | null> {
  const { data, error } = await supabase
    .from("huddles")
    .select(SELECT)
    .eq(container.kind === "channel" ? "channel_id" : "conversation_id", container.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? shape(data as unknown as Row) : null;
}

export async function getHuddleById(supabase: Supabase, id: string): Promise<ActiveHuddle | null> {
  const { data, error } = await supabase.from("huddles").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? shape(data as unknown as Row) : null;
}

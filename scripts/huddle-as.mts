// Dev helper: join or leave a huddle as a seeded member (participant rows only; no media).
//   node --env-file=.env.local --import tsx scripts/huddle-as.mts nadia@potara.studio join <huddleId>
//   node --env-file=.env.local --import tsx scripts/huddle-as.mts nadia@potara.studio leave <huddleId>
//   node --env-file=.env.local --import tsx scripts/huddle-as.mts nadia@potara.studio active general
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getActiveHuddle } from "@/lib/queries/huddles";

const [email, verb, target] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
const user = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: vErr } = await user.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (vErr) throw vErr;
const uid = auth.user!.id;

if (verb === "active") {
  const { data: ch } = await user.from("channels").select("id").eq("name", target).single();
  const h = await getActiveHuddle(user, { kind: "channel", id: ch!.id });
  console.log(h ? { id: h.id, room: h.livekit_room, participants: h.participants.map((p) => p.handle) } : "no active huddle");
} else if (verb === "join") {
  const now = new Date().toISOString();
  const { error: e } = await user.from("huddle_participants").insert({ huddle_id: target, user_id: uid, joined_at: now });
  console.log(e ? `join failed: ${e.message}` : "joined");
} else if (verb === "leave") {
  const now = new Date().toISOString();
  const { error: e } = await user.from("huddle_participants").update({ left_at: now }).eq("huddle_id", target).eq("user_id", uid).is("left_at", null);
  const { count } = await user.from("huddle_participants").select("user_id", { count: "exact", head: true }).eq("huddle_id", target).is("left_at", null);
  if ((count ?? 0) === 0) await user.from("huddles").update({ ended_at: now }).eq("id", target).is("ended_at", null);
  console.log(e ? `leave failed: ${e.message}` : `left; remaining ${count ?? 0}${(count ?? 0) === 0 ? " → ended" : ""}`);
}
process.exit(0);

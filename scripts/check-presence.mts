// Dev check: join presence as Nadia (online + typing in #general) for ~12 s so a browser session can see the dot and the indicator.
// Run: pnpm tsx scripts/check-presence.mts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: "nadia@potara.studio" });
if (error) throw error;
const nadia = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: vErr } = await nadia.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (vErr) throw vErr;
const uid = auth.user!.id;
const { data: { session } } = await nadia.auth.getSession();
await nadia.realtime.setAuth(session!.access_token);
const { data: ch } = await nadia.from("channels").select("id").eq("name", "general").single();

const online = nadia.channel("presence:online", { config: { presence: { key: uid } } });
await new Promise<void>((resolve) => online.subscribe((s) => s === "SUBSCRIBED" && resolve()));
await online.track({ user_id: uid, online_at: new Date().toISOString() });
console.log("online as nadia; peers:", Object.keys(online.presenceState()));

const typing = nadia.channel(`typing:channel:${ch!.id}`, { config: { presence: { key: uid } } });
await new Promise<void>((resolve) => typing.subscribe((s, err) => { console.log("typing status:", s, err?.message ?? ""); if (s === "SUBSCRIBED") resolve(); }));
// Track once (typing started), hold for 12 s, then untrack (typing stopped).
console.log("track:", await typing.track({ user_id: uid, name: "Nadia Putri", at: Date.now() }));
await new Promise((r) => setTimeout(r, 12000));
await typing.untrack();
console.log("typing stopped; staying online 3 more seconds");
await new Promise((r) => setTimeout(r, 3000));
await nadia.removeAllChannels();
process.exit(0);

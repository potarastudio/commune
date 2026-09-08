// Dev check: walks three pages of #general through RLS as a seeded member. Run: pnpm tsx scripts/check-pagination.mts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fetchChannelMessages } from "@/lib/queries/messages";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(url, service, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: "nadia@potara.studio" });
if (error) throw error;

const user = createClient<Database>(url, anon, { auth: { persistSession: false } });
const { error: vErr } = await user.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (vErr) throw vErr;

const { data: ch } = await user.from("channels").select("id").eq("name", "general").single();
const p1 = await fetchChannelMessages(user, ch!.id);
const p2 = await fetchChannelMessages(user, ch!.id, p1.nextCursor);
const p3 = await fetchChannelMessages(user, ch!.id, p2.nextCursor);
const ids = new Set([...p1.messages, ...p2.messages, ...p3.messages].map((m) => m.id));
console.log({
  page1: p1.messages.length, page2: p2.messages.length, page3: p3.messages.length,
  cursors: [p1.nextCursor !== null, p2.nextCursor !== null, p3.nextCursor !== null],
  unique: ids.size,
  ordered: p2.messages.every((m, i, a) => i === 0 || a[i - 1].created_at <= m.created_at),
  boundary: p2.messages[p2.messages.length - 1].created_at <= p1.messages[0].created_at,
  authorJoined: p1.messages.every((m) => m.author !== null),
});

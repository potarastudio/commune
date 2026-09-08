// Dev helper: post a message as a seeded member. Run:
//   pnpm tsx scripts/post-as.mts nadia@potara.studio design "Hello from Nadia"
//   pnpm tsx scripts/post-as.mts nadia@potara.studio dm:<conversation uuid> "Hello"
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { insertMessage } from "@/lib/queries/messages";
import { docFromText } from "@/lib/utils/tiptap";

const [email, target, ...words] = process.argv.slice(2);
const text = words.join(" ") || "Hello from a script";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
const user = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { error: vErr } = await user.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (vErr) throw vErr;

let container: { kind: "channel" | "conversation"; id: string };
if (target.startsWith("dm:")) {
  container = { kind: "conversation", id: target.slice(3) };
} else {
  const { data: ch } = await user.from("channels").select("id").eq("name", target).single();
  container = { kind: "channel", id: ch!.id };
}
// MENTION_HANDLE=hakim prepends an @mention node so the mentions table gets a row.
const content = docFromText(text) as { type: string; content: { type: string; content?: unknown[] }[] };
if (process.env.MENTION_HANDLE) {
  const { data: p } = await user.from("profiles").select("id, handle").eq("handle", process.env.MENTION_HANDLE).single();
  content.content[0].content = [{ type: "mention", attrs: { id: p!.id, label: p!.handle } }, { type: "text", text: " " + text }];
}
const row = await insertMessage(user, { container, content: content as Record<string, unknown>, contentText: text });
console.log(`posted ${row.id} to ${container.kind} ${container.id}`);

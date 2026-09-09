// Dev check: subscribe as Hakim to #design inserts (RLS-filtered), post as Sari, expect the event. Run: pnpm tsx scripts/check-realtime.mts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { insertMessage } from "@/lib/queries/messages";
import { docFromText } from "@/lib/utils/tiptap";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function loginAs(email: string) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: vErr } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (vErr) throw vErr;
  return client;
}

const hakim = await loginAs("hi@potarastudio.com");
const sari = await loginAs("sari@potara.studio");
const { data: ch } = await hakim.from("channels").select("id").eq("name", "design").single();

const { data: { session } } = await hakim.auth.getSession();
await hakim.realtime.setAuth(session!.access_token);

const status = await new Promise<string>((resolve) => {
  hakim
    .channel("check")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${ch!.id}` }, (p) => {
      console.log("event received:", (p.new as { content_text: string }).content_text);
      resolve("EVENT");
    })
    .subscribe((s, err) => {
      console.log("subscribe status:", s, err?.message ?? "");
      if (s === "SUBSCRIBED") {
        setTimeout(() => {
          void insertMessage(sari, { container: { kind: "channel", id: ch!.id }, content: docFromText("realtime check") as Record<string, unknown>, contentText: "realtime check" });
        }, 500);
      }
      if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(s);
    });
  setTimeout(() => resolve("NO_EVENT_AFTER_8S"), 8000);
});
console.log("result:", status);
process.exit(status === "EVENT" ? 0 : 1);

// Verifies the PRODUCTION deploy mints LiveKit tokens with the rotated key.
//   node --env-file=.env.hosted --import tsx scripts/check-prod-livekit.mts
// Signs in as the founder via a one-off magic link (no email sent), creates a
// throwaway huddle in #general, asks production for a join token, checks the
// token was signed with the key in .env.local, then deletes the huddle.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { TokenVerifier } from "livekit-server-sdk";
import type { Database } from "@/types/database";

const local = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => /^LIVEKIT_/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1")];
  }),
);
const PROD = "https://commune-tan.vercel.app";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// 1. Session for the founder.
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: "hi@potarastudio.com" });
if (error) throw error;
const jar = new Map<string, string>();
const ssr = createServerClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
});
const { data: auth, error: vErr } = await ssr.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (vErr) throw vErr;
const cookie = [...jar].filter(([n]) => n.startsWith(`sb-${ref}`)).map(([n, v]) => `${n}=${v}`).join("; ");
console.log("signed in as", auth.user?.email, "| cookies:", jar.size);

// 2. Throwaway huddle in #general.
const { data: general } = await admin.from("channels").select("id").eq("name", "general").single();
const room = `check-${Date.now()}`;
const { data: huddle, error: hErr } = await admin
  .from("huddles")
  .insert({ channel_id: general!.id, livekit_room: room, started_by: auth.user!.id })
  .select("id")
  .single();
if (hErr) throw hErr;

try {
  // 3. Ask production for a token.
  const res = await fetch(`${PROD}/api/livekit/token?huddle=${huddle.id}`, { headers: { cookie } });
  const body = (await res.json()) as { token?: string; url?: string; error?: string };
  console.log("production token route:", res.status, body.error ?? "ok", "| url:", body.url);
  if (!body.token) process.exit(1);

  // 4. Was it signed with the rotated key?
  const [, payload] = body.token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  console.log("token iss matches .env.local key:", claims.iss === local.LIVEKIT_API_KEY);
  try {
    const v = new TokenVerifier(local.LIVEKIT_API_KEY, local.LIVEKIT_API_SECRET);
    const grant = await v.verify(body.token);
    console.log("signature valid with .env.local secret: true | room grant:", grant.video?.room);
  } catch (e) {
    console.log("signature valid with .env.local secret: FALSE →", (e as Error).message);
  }
} finally {
  await admin.from("huddles").delete().eq("id", huddle.id);
  await ssr.auth.signOut();
  console.log("cleanup: huddle deleted, session revoked");
}
process.exit(0);

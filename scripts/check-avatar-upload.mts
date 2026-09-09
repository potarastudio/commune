// Dev check: uploads a tiny PNG to the avatars bucket as a seeded member and fetches it back. Run: pnpm tsx scripts/check-avatar-upload.mts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: "sari@potara.studio" });
if (error) throw error;
const user = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: session, error: vErr } = await user.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (vErr) throw vErr;
const uid = session.user!.id;

// 1x1 transparent PNG
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const own = await user.storage.from("avatars").upload(`${uid}/avatar.png`, png, { upsert: true, contentType: "image/png" });
const foreign = await user.storage.from("avatars").upload(`00000000-0000-4000-8000-000000000001/avatar.png`, png, { upsert: true, contentType: "image/png" });
const { data: pub } = user.storage.from("avatars").getPublicUrl(`${uid}/avatar.png`);
const res = await fetch(pub.publicUrl);
console.log({ ownUpload: own.error?.message ?? "ok", foreignUpload: foreign.error?.message ?? "UNEXPECTEDLY ALLOWED", publicFetch: res.status, contentType: res.headers.get("content-type") });

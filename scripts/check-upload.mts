// Dev check: signed-URL upload as Nadia, message with attachment, signed read, and RLS on the object. Run: pnpm tsx scripts/check-upload.mts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fetchMessageById, insertMessage } from "@/lib/queries/messages";
import { docFromText } from "@/lib/utils/tiptap";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function loginAs(email: string) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const c = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: vErr } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (vErr) throw vErr;
  return { client: c, uid: data.user!.id };
}
const nadia = await loginAs("nadia@potara.studio");
const mallory = await loginAs("raka@potara.studio");

// Raka is in every seeded channel, so use a fresh private channel Raka is NOT in to test object RLS.
// Created with the service role: a member's own RETURNING would be evaluated before the auto-join trigger runs.
const { data: priv, error: chErr } = await admin.from("channels").insert({ name: `upload-rls-${Date.now() % 100000}`, is_private: true, created_by: nadia.uid }).select("id").single();
if (chErr) throw chErr;

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const path = `${nadia.uid}/${crypto.randomUUID()}/dot.png`;
const signed = await nadia.client.storage.from("attachments").createSignedUploadUrl(path);
if (signed.error) throw signed.error;
const up = await nadia.client.storage.from("attachments").uploadToSignedUrl(signed.data.path, signed.data.token, png, { contentType: "image/png" });
if (up.error) throw up.error;

const row = await insertMessage(nadia.client, {
  container: { kind: "channel", id: priv!.id },
  content: docFromText("with a file") as Record<string, unknown>,
  contentText: "with a file",
  attachments: [{ storage_path: path, file_name: "dot.png", mime_type: "image/png", size_bytes: png.length, width: 1, height: 1 }],
});
const full = await fetchMessageById(nadia.client, row.id);
const read = await nadia.client.storage.from("attachments").createSignedUrl(path, 60);
const fetched = read.data ? (await fetch(read.data.signedUrl)).status : null;
const foreignRead = await mallory.client.storage.from("attachments").createSignedUrl(path, 60);
const foreignInsert = await insertMessage(mallory.client, {
  container: { kind: "channel", id: (await mallory.client.from("channels").select("id").eq("name", "general").single()).data!.id },
  content: docFromText("stealing") as Record<string, unknown>,
  contentText: "stealing",
  attachments: [{ storage_path: path, file_name: "dot.png", mime_type: "image/png", size_bytes: 1, width: null, height: null }],
}).then(() => "UNEXPECTEDLY ALLOWED", (e: Error) => e.message);

console.log({
  attachmentsOnMessage: full?.attachments.length,
  storedPath: full?.attachments[0]?.storage_path === path,
  signedReadStatus: fetched,
  nonMemberSignedUrl: foreignRead.error?.message ?? "UNEXPECTEDLY ALLOWED",
  attachOthersFile: foreignInsert,
});

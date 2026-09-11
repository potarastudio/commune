// Dev check: the large-attachment path against the real R2 bucket. A 100 MB
// file with spaces and brackets in its name goes through the actual composer,
// is sent, viewed, downloaded, checked in the database and the bucket, then
// removed from both. Needs the dev server on 3001 with R2_* in .env.local,
// and the local Supabase stack seeded.
//   node --import tsx scripts/check-r2.mts
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// .env.local, parsed the way dotenv does: first "=", trimmed, quotes stripped.
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
  if (!m || line.trim().startsWith("#")) continue;
  process.env[m[1]] ??= m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const designId = execFileSync("psql", [DB, "-Atc", "select id from channels where name='design'"], { encoding: "utf8" }).trim();
const NAME = "hero v4 (final).bin";
const MB = 1024 * 1024;
const SIZE = 100 * MB;
const rows: string[] = [];
const ok = (label: string, pass: boolean, detail = "") => rows.push(`${pass ? "✓" : "✗"} ${label}${detail ? "   " + detail : ""}`);

// Sweep leftovers from an earlier run: their objects in the bucket, then their messages.
{
  const r2 = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: old } = await admin.from("attachments").select("message_id, storage_path").eq("file_name", NAME).eq("provider", "r2");
  for (const a of old ?? []) {
    const u = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${a.storage_path.split("/").map(encodeURIComponent).join("/")}`;
    const d = await r2.fetch(u, { method: "DELETE" });
    await admin.from("messages").delete().eq("id", a.message_id);
    rows.push(`· swept a leftover from an earlier run (object delete ${d.status})`);
  }
}

// Playwright refuses in-memory files over 50 MB; write it to disk.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "commune-r2-"));
const filePath = path.join(tmp, NAME);
fs.writeFileSync(filePath, Buffer.alloc(SIZE, 7));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0].slice(0, 100)));
await page.goto("http://localhost:3001/auth/dev-login?email=hi@potarastudio.com", { waitUntil: "networkidle" });
await page.goto(`http://localhost:3001/channel/${designId}`, { waitUntil: "networkidle", timeout: 60000 });

// 1. Attach 100 MB. Under the old limit the client would refuse this at once.
await page.locator('input[type="file"]').first().setInputFiles(filePath);
await page.waitForTimeout(800);
const refused = (await page.getByText(/Files need to be under/).count()) > 0;
ok("100 MB accepted by the composer (limit is now 1 GB)", !refused);

// 2. A real progress bar, then done.
let sawProgress = "";
const t0 = Date.now();
let lastText = "";
while (Date.now() - t0 < 5 * 60_000) {
  lastText = await page.evaluate(() => document.body.innerText);
  const m = /Uploading · (\d+)% of 100 MB/.exec(lastText);
  if (m && Number(m[1]) > 0 && Number(m[1]) < 100 && !sawProgress) sawProgress = `${m[1]}% at ${Math.round((Date.now() - t0) / 1000)}s`;
  if (!/Uploading ·/.test(lastText) && lastText.includes(NAME)) break;
  if (/Couldn't upload/.test(lastText)) break;
  await page.waitForTimeout(500);
}
const failMsg = /Couldn't upload[^\n]*\n?([^\n]*)/.exec(lastText);
ok("upload reported byte progress", Boolean(sawProgress), sawProgress);
ok("upload finished without error", !failMsg, failMsg ? failMsg[0].replace(/\n/g, " ").slice(0, 120) : `${Math.round((Date.now() - t0) / 1000)}s`);

let cleanupPath = "";
let downloadUrl = "";
if (!failMsg) {
  // 3. Send it.
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.type("R2 live test");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: `Download ${NAME}` }).first().waitFor({ timeout: 30000 });
  ok("message with the attachment appears", true);

  // 4. Database row.
  let row = "";
  for (let i = 0; i < 40 && !row; i++) {
    row = execFileSync("psql", [DB, "-Atc", `select provider||'|'||size_bytes||'|'||storage_path from attachments where file_name='${NAME}' order by created_at desc limit 1`], { encoding: "utf8" }).trim();
    if (!row) await page.waitForTimeout(250);
  }
  const [provider, size, storagePath] = row.split("|");
  cleanupPath = storagePath;
  ok("row says r2 with the right size", provider === "r2" && Number(size) === SIZE, `${provider}, ${size} bytes`);

  // 5. Download goes to R2, and the object is really there with the right size.
  const dl = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: `Download ${NAME}` }).first().click();
  const d = await dl;
  downloadUrl = d.url();
  ok("download URL is a presigned R2 link", /r2\.cloudflarestorage\.com/.test(downloadUrl) && downloadUrl.includes("X-Amz-Signature"), new URL(downloadUrl).host);
  const probe = await fetch(downloadUrl, { headers: { range: "bytes=0-0" } });
  const total = Number(/\/(\d+)$/.exec(probe.headers.get("content-range") ?? "")?.[1] ?? 0);
  ok("object served by R2 with the right size", probe.status === 206 && total === SIZE, `${probe.status}, content-range total ${total}`);
  ok("saved-as name preserved", d.suggestedFilename() === NAME, d.suggestedFilename());
  await d.cancel().catch(() => {});
}

ok("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });

// 6. Clean up: the object, then the message (its attachment row cascades).
if (cleanupPath) {
  const r2 = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
  const objectUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${cleanupPath.split("/").map(encodeURIComponent).join("/")}`;
  const del = await r2.fetch(objectUrl, { method: "DELETE" });
  const gone = downloadUrl ? (await fetch(downloadUrl, { headers: { range: "bytes=0-0" } })).status : 0;
  ok("cleanup: object deleted from the bucket", del.status === 204 && gone === 404, `delete ${del.status}, then ${gone}`);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: att } = await admin.from("attachments").select("message_id").eq("storage_path", cleanupPath).maybeSingle();
  if (att) await admin.from("messages").delete().eq("id", att.message_id);
  ok("cleanup: test message removed", Boolean(att));
}

console.log(rows.join("\n"));
process.exit(rows.some((r) => r.startsWith("✗")) ? 1 : 0);

// Dev check: text computed from "now" must not break hydration.
//
// The server renders a page at one instant and the browser hydrates it a
// moment later. Any text derived from the current time ("Last reply 3
// minutes ago") can differ between the two whenever a boundary falls in that
// gap, and React reports a hydration mismatch. In practice the gap is a
// second or two and the failure is rare and random; this check makes it
// certain by setting the browser's clock 90 seconds ahead of the server's,
// on a channel with a reply made moments ago.
//   node --import tsx scripts/check-hydration-time.mts   (dev server on 3001)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { insertMessage } from "@/lib/queries/messages";
import { docFromText } from "@/lib/utils/tiptap";
import type { Database } from "@/types/database";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
  if (!m || line.trim().startsWith("#")) continue;
  process.env[m[1]] ??= m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const q = (sql: string) => execFileSync("psql", [DB, "-Atc", sql], { encoding: "utf8" }).trim();
const generalId = q("select id from channels where name='general'");
const parentId = q(`select id from messages where channel_id='${generalId}' and parent_id is null and deleted_at is null order by created_at desc limit 1`);

// A reply made just now, as a member, so the channel shows "Last reply … seconds ago".
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "sari@potara.studio" });
const sari = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
await sari.auth.verifyOtp({ type: "magiclink", token_hash: link!.properties.hashed_token });
const reply = await insertMessage(sari, { container: { kind: "channel", id: generalId }, parentId, content: docFromText("hydration-time probe"), contentText: "hydration-time probe" });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const problems: string[] = [];
const note = (msg: string) => {
  if (!/hydrat|didn't match/i.test(msg)) return;
  // React's own diff follows its link; the "- A server/client branch" bullets above it are boilerplate.
  const tail = msg.split("hydration-mismatch").slice(1).join("");
  const diff = tail.split("\n").filter((l) => /^\s*[+-]\s/.test(l)).slice(0, 400).join(" / ").replace(/\s+/g, " ");
  problems.push(`${msg.split("\n")[0].slice(0, 80)}${diff ? "  [" + diff.slice(0, 40000) + "]" : ""}`);
};
page.on("pageerror", (e) => note(e.message));
page.on("console", (m) => m.type() === "error" && note(m.text()));

await page.goto("http://localhost:3001/auth/dev-login?email=hi@potarastudio.com", { waitUntil: "networkidle" });
await page.clock.setFixedTime(new Date(Date.now() + 90_000)); // the browser is 90 s ahead of the server
await page.goto(`http://localhost:3001/channel/${generalId}`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2500);
const shown = await page.evaluate(() => [...document.body.innerText.matchAll(/Last reply [^\n]+/g)].map((m) => m[0]).slice(-1)[0] ?? "none");
await browser.close();

await admin.from("messages").delete().eq("id", reply.id);

console.log(`latest reply line: ${shown}`);
console.log(problems.length ? `✗ hydration mismatch\n  ${[...new Set(problems)].join("\n  ")}` : "✓ no hydration mismatch with the browser 90 s ahead");
process.exit(problems.length ? 1 : 0);

/**
 * Screenshot every surface at 1440x900 in light and dark (§8), for design review.
 *   node --import tsx scripts/shoot-pages.mts <outDir> [only]
 * Requires the dev server on 3001 and the local Supabase stack seeded.
 */
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const [out, only] = process.argv.slice(2);
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const q = (sql: string) => execFileSync("psql", [DB, "-Atc", sql], { encoding: "utf8" }).trim();

const designId = q("select id from channels where name='design'");
const generalId = q("select id from channels where name='general'");
const dmId = q(
  "select c.id from conversations c join conversation_members m on m.conversation_id=c.id group by c.id having count(*)=2 limit 1",
);

type Shot = { name: string; path: string; prep?: (p: Page) => Promise<void>; signedOut?: boolean };

const SHOTS: Shot[] = [
  // Signed out: middleware bounces /login to / for an authenticated session.
  { name: "login", path: "/login", signedOut: true },
  { name: "login-sent", path: "/login", signedOut: true, prep: async (p) => {
      await p.locator("#magic-email").fill("hi@potarastudio.com");
      await p.getByRole("button", { name: /Email me a link/ }).click();
      await p.getByText(/Check your inbox/).waitFor({ timeout: 20000 });
    } },
  { name: "login-rejected", path: "/login", signedOut: true, prep: async (p) => {
      await p.locator("#magic-email").fill("nobody@example.com");
      await p.getByRole("button", { name: /Email me a link/ }).click();
      await p.getByRole("alert").first().waitFor({ timeout: 20000 });
    } },
  { name: "login-error", path: "/login?error=link", signedOut: true },
  { name: "channel", path: `/channel/${designId}` },
  { name: "channel-general", path: `/channel/${generalId}` },
  { name: "channel-panel-about", path: `/channel/${designId}?panel=details&tab=about` },
  { name: "channel-panel-members", path: `/channel/${designId}?panel=details&tab=members` },
  { name: "channel-panel-files", path: `/channel/${designId}?panel=details&tab=files` },
  { name: "channel-panel-pins", path: `/channel/${designId}?panel=details&tab=pins` },
  { name: "dm", path: `/dm/${dmId}` },
  { name: "dm-new", path: "/dm/new" },
  { name: "activity", path: "/activity" },
  { name: "saved", path: "/saved" },
  { name: "browse", path: "/channels" },
  { name: "search-empty", path: "/search" },
  { name: "search-results", path: "/search?q=hero" },
  { name: "settings", path: "/settings" },
  { name: "welcome", path: "/welcome" },
  { name: "privacy", path: "/privacy" },
  { name: "palette", path: `/channel/${designId}`, prep: async (p) => {
      await p.keyboard.press("Meta+k");
      await p.getByRole("dialog").waitFor({ timeout: 10000 });
      await p.waitForTimeout(400);
    } },
  { name: "shortcuts", path: `/channel/${designId}`, prep: async (p) => {
      await p.keyboard.press("Meta+/");
      await p.getByRole("dialog").waitFor({ timeout: 10000 });
      await p.waitForTimeout(400);
    } },
];

const browser = await chromium.launch();
const failures: string[] = [];

for (const theme of ["light", "dark"] as const) {
  // Signed-in session for the app, and a separate anonymous one for /login.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto("http://localhost:3001/auth/dev-login?email=hi@potarastudio.com");
  await page.goto("http://localhost:3001/settings");
  await page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" }).click().catch(() => {});
  await page.waitForTimeout(400);

  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const anonPage = await anon.newPage();

  for (const s of SHOTS) {
    if (only && !s.name.includes(only)) continue;
    errors.length = 0;
    const p = s.signedOut ? anonPage : page;
    try {
      await p.goto(`http://localhost:3001${s.path}`, { waitUntil: "networkidle", timeout: 30000 });
      if (s.prep) await s.prep(p);
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${out}/${s.name}-${theme}.png` });
      const note = errors.length ? `  ⚠ ${errors[0]}` : "";
      console.log(`${s.name}-${theme}${note}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
      failures.push(`${s.name}-${theme}: ${msg}`);
      console.log(`${s.name}-${theme}  ✗ ${msg}`);
    }
  }
  await anon.close();
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} failed:`);
  for (const f of failures) console.log("  " + f);
}

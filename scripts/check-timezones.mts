// Dev check: every time the app draws follows the viewer's *profile* time
// zone, identically in the server's HTML and after hydration.
//
// Run the dev server on UTC, as Vercel does, or the check proves nothing:
//   TZ=UTC pnpm dev        (or the "commune-utc" entry in .claude/launch.json)
//   node --import tsx scripts/check-timezones.mts
//
// It signs in as Hakim (profile zone Asia/Jakarta) and visits the pages that
// print times twice: once with the browser in Jakarta and once in New York.
// On each page the <time> elements in the server HTML must match what the
// browser shows, with no hydration error, and both browsers must show the
// same times, because the profile decides, not the browser. Then it changes
// the zone to Tokyo through the real Settings form and checks every time
// moves two hours, and puts Jakarta back.
import { chromium, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

const DEV = "http://localhost:3001";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const q = (sql: string) => execFileSync("psql", [DB, "-Atc", sql], { encoding: "utf8" }).trim();
const EMAIL = "hi@potarastudio.com";

const generalId = q("select id from channels where name='general'");
// The busiest 1:1 DM, so its header draws the other person's clock too.
const dmId = q(
  `select c.conversation_id from conversation_members c join profiles p on p.id=c.user_id
   join messages m on m.conversation_id=c.conversation_id and m.deleted_at is null
   where p.email='${EMAIL}' and (select count(*) from conversation_members x where x.conversation_id=c.conversation_id)=2
   group by 1 order by count(*) desc limit 1`,
);
const PAGES: [string, string][] = [
  ["channel", `/channel/${generalId}`],
  ["channel + details", `/channel/${generalId}?panel=details&tab=about`],
  ["dm", `/dm/${dmId}`],
  ["search", "/search?q=hero"],
  ["saved", "/saved"],
  ["activity", "/activity"],
];

const rows: string[] = [];
const ok = (label: string, pass: boolean, detail = "") => rows.push(`${pass ? "✓" : "✗"} ${label}${detail ? "   " + detail : ""}`);

/** Text of every <time> element in server HTML: tags and React's <!-- --> separators removed. */
function ssrTimes(html: string): string[] {
  return [...html.matchAll(/<time\b[^>]*>([\s\S]*?)<\/time>/g)].map((m) =>
    m[1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim(),
  );
}

async function visit(ctx: BrowserContext, path: string) {
  const page = await ctx.newPage();
  const errors: string[] = [];
  const note = (msg: string) => {
    if (!/hydrat|didn't match/i.test(msg)) return;
    // React's diff follows its link: the first + or - line names what differed.
    const diff = msg.split("hydration-mismatch").slice(1).join("").split("\n").find((l) => /^\s*[+-]\s/.test(l))?.trim();
    errors.push(`${msg.split("\n")[0].slice(0, 60)}${diff ? `  [${diff.slice(0, 120)}]` : ""}`);
  };
  page.on("pageerror", (e) => note(e.message));
  page.on("console", (m) => m.type() === "error" && note(m.text()));
  // The server HTML is this navigation's own response, so both sides saw the same data.
  const response = await page.goto(`${DEV}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  const html = (await response?.text()) ?? "";
  await page.waitForTimeout(1500);
  const shown = await page.$$eval("time", (els) => els.map((e) => (e.textContent ?? "").trim()));
  await page.close();
  return { ssr: ssrTimes(html), shown, errors };
}

async function signedIn(timezoneId: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId });
  const p = await ctx.newPage();
  await p.goto(`${DEV}/auth/dev-login?email=${EMAIL}`, { waitUntil: "networkidle" });
  await p.close();
  return ctx;
}

/** The items of `a` left after removing one match from `b` for each. */
function without(a: string[], b: string[]): string[] {
  const left = [...b];
  return a.filter((x) => {
    const i = left.indexOf(x);
    if (i === -1) return true;
    left.splice(i, 1);
    return false;
  });
}

const shift = (hhmm: string, hours: number) =>
  hhmm.replace(/\b(\d{2}):(\d{2})\b/g, (_, h, m) => `${String((Number(h) + hours + 24) % 24).padStart(2, "0")}:${m}`);

const originalZone = q(`select timezone from profiles where email='${EMAIL}'`);
const originalAvatar = q(`select coalesce(avatar_url, '') from profiles where email='${EMAIL}'`);
q(`update profiles set timezone='Asia/Jakarta' where email='${EMAIL}'`);
const browser = await chromium.launch();

try {
  // 1. Server HTML equals what the browser shows, in two browser zones.
  const seen: Record<string, Record<string, string[]>> = {};
  for (const zone of ["Asia/Jakarta", "America/New_York"]) {
    const ctx = await signedIn(zone);
    seen[zone] = {};
    for (const [name, path] of PAGES) {
      const r = await visit(ctx, path);
      seen[zone][name] = r.shown;
      // Compared as a multiset: streamed sections reach the HTML in whatever
      // order they finish, and the browser then moves each into place.
      const onlyServer = without(r.ssr, r.shown);
      const onlyBrowser = without(r.shown, r.ssr);
      const same = onlyServer.length === 0 && onlyBrowser.length === 0;
      ok(`${zone.padEnd(16)} ${name.padEnd(17)} server HTML = browser, no hydration error`, same && r.errors.length === 0,
        `${r.shown.length} times, e.g. ${r.shown.slice(-2).join(" | ") || "none"}${same ? "" : `  SERVER ONLY ${onlyServer.slice(0, 3).join(" | ")}  BROWSER ONLY ${onlyBrowser.slice(0, 3).join(" | ")}`}${r.errors.length ? "  " + r.errors[0] : ""}`);
    }
    await ctx.close();
  }

  // 2. The profile decides, not the browser.
  for (const [name] of PAGES) {
    const a = seen["Asia/Jakarta"][name];
    const b = seen["America/New_York"][name];
    ok(`${name.padEnd(17)} same times in a Jakarta and a New York browser`, JSON.stringify(a) === JSON.stringify(b));
  }
  const pagesWithTimes = PAGES.filter(([n]) => seen["Asia/Jakarta"][n].length > 0).length;
  ok("every page with times actually printed some", pagesWithTimes >= 5, `${pagesWithTimes} of ${PAGES.length} pages`);

  // 3. The newest #general message is drawn in Jakarta time, computed here independently.
  const newest = q(`select created_at from messages where channel_id='${generalId}' and parent_id is null and deleted_at is null order by created_at desc limit 1`);
  const expected = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(newest.replace(" ", "T").replace(/\+00$/, "Z")));
  ok("newest #general message is in Jakarta time", seen["America/New_York"]["channel"].includes(expected), `expected ${expected}`);

  // 4. Changing the zone in Settings moves every time.
  // The local seed gives Hakim a DiceBear avatar, which saveProfileAction
  // refuses ("That avatar doesn't belong to you"), so the form could not save
  // at all. Clear it for this step; the finally block puts it back.
  q(`update profiles set avatar_url=null where email='${EMAIL}'`);
  try {
    const ctx = await signedIn("America/New_York");
    const before = seen["Asia/Jakarta"]["channel"];
    const tokyo = before.map((t) => shift(t, 2));
    const page = await ctx.newPage();
    const zoneNow = () => q(`select timezone from profiles where email='${EMAIL}'`);

    /** Picks a zone in the real Settings form and saves it. */
    const saveZone = async (zone: string) => {
      await page.goto(`${DEV}/settings`, { waitUntil: "networkidle" });
      // Wait for React to own the control; a change made before hydration is lost.
      await page.waitForFunction(
        () => {
          const el = [...document.querySelectorAll("select#timezone")].find((e) => (e as HTMLElement).offsetParent !== null);
          return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
        },
        undefined,
        { timeout: 30_000 },
      );
      await page.locator("select#timezone:visible").selectOption(zone);
      await page.getByRole("button", { name: "Save changes" }).click({ timeout: 10_000 });
      for (let i = 0; i < 30 && zoneNow() !== zone; i++) await page.waitForTimeout(250);
    };

    await saveZone("Asia/Tokyo");
    ok("Settings saves the new zone", zoneNow() === "Asia/Tokyo", zoneNow());

    // In the app, without a reload: "Back to Commune" lands on #general.
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Back to Commune" }).click();
    await page.waitForURL(`**/channel/${generalId}`);
    await page
      .waitForFunction((t) => [...document.querySelectorAll("time")].some((e) => e.textContent?.trim() === t), tokyo[tokyo.length - 1], { timeout: 20_000 })
      .catch(() => {});
    const inApp = await page.$$eval("time", (els) => els.map((e) => (e.textContent ?? "").trim()));
    ok(
      "then #general, reached with Back to Commune and no reload, is two hours later",
      inApp.length > 0 && JSON.stringify(inApp) === JSON.stringify(tokyo),
      `${before.slice(-1)[0]} → ${inApp.slice(-1)[0]}`,
    );

    const after = (await visit(ctx, `/channel/${generalId}`)).shown;
    ok(
      "and a fresh load of #general is two hours later too",
      after.length > 0 && JSON.stringify(after) === JSON.stringify(tokyo),
      `${before.slice(-1)[0]} → ${after.slice(-1)[0]}`,
    );

    await saveZone("Asia/Jakarta");
    ok("Settings puts Jakarta back", zoneNow() === "Asia/Jakarta");
    await ctx.close();
  } catch (e) {
    ok("Settings zone change", false, String(e).split("\n")[0].slice(0, 140));
  }
} finally {
  await browser.close();
  const sql = (v: string) => (v ? `'${v.replace(/'/g, "''")}'` : "null");
  q(`update profiles set timezone=${sql(originalZone)}, avatar_url=${sql(originalAvatar)} where email='${EMAIL}'`);
  console.log(rows.join("\n"));
}

process.exit(rows.some((r) => r.startsWith("✗")) ? 1 : 0);

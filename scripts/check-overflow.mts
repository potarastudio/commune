/**
 * Horizontal-overflow audit across the app's surfaces at laptop widths (§6).
 *   node --import tsx scripts/check-overflow.mts <outDir>
 * Screenshots only the widths that actually overflow, so a clean run writes
 * nothing. Requires the dev server on 3001 and the local stack seeded.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";

const out = process.argv[2] ?? ".";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const q = (sql: string) => execFileSync("psql", [DB, "-Atc", sql], { encoding: "utf8" }).trim();
const designId = q("select id from channels where name='design'");
const dmId = q(
  "select c.id from conversations c join conversation_members m on m.conversation_id=c.id group by c.id having count(*)=2 limit 1",
);

const PATHS: [string, string][] = [
  ["channel", `/channel/${designId}`],
  ["channel-panel", `/channel/${designId}?panel=details&tab=members`],
  ["dm", `/dm/${dmId}`],
  ["search", "/search?q=hero"],
  ["settings", "/settings"],
  ["activity", "/activity"],
  ["saved", "/saved"],
  ["browse", "/channels"],
  ["profile", "/u/sari"],
];
const WIDTHS = [1280, 1024, 900];

/**
 * Two failures, both of which look like nothing until a panel is open.
 *
 * `over` is anything laid out past the viewport's right edge — that is what
 * makes the page itself scroll sideways.
 *
 * `escaped` is a child spilling out of a bordered, rounded box it is drawn
 * inside. That never moves the page, so the viewport test misses it entirely:
 * the composer's send button sat outside its own rounded border at 1024 with
 * the details panel open and the page measured perfectly clean.
 *
 * Fixed and absolute boxes are skipped in both: the hover toolbar and the
 * popovers are supposed to sit outside their row.
 */
const PROBE = `(() => {
  const de = document.documentElement;
  const over = [], escaped = [];
  const inFlow = (el) => { const p = getComputedStyle(el).position; return p !== 'fixed' && p !== 'absolute'; };
  const name = (el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 70);

  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || !inFlow(el)) continue;
    if (r.right > de.clientWidth + 1) over.push(name(el) + ' right=' + Math.round(r.right));
  }

  // Every visible bordered card, checked against its own in-flow descendants.
  for (const box of document.querySelectorAll('*')) {
    const cs = getComputedStyle(box);
    if (cs.borderRightWidth === '0px' || cs.overflowX !== 'visible') continue;
    const b = box.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    for (const kid of box.querySelectorAll('*')) {
      const k = kid.getBoundingClientRect();
      if (k.width === 0 || k.height === 0 || !inFlow(kid)) continue;
      if (k.right > b.right + 1 || k.left < b.left - 1) {
        escaped.push(name(kid) + ' escapes ' + name(box));
        break;
      }
    }
  }
  return {
    overflows: de.scrollWidth > de.clientWidth + 1,
    scrollW: de.scrollWidth, clientW: de.clientWidth,
    over: over.slice(0, 4), escaped: [...new Set(escaped)].slice(0, 4),
  };
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3001/auth/dev-login?email=hi@potarastudio.com");

let bad = 0;
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  for (const [name, path] of PATHS) {
    await page.goto(`http://localhost:3001${path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(350);
    const r = (await page.evaluate(PROBE)) as {
      overflows: boolean;
      scrollW: number;
      clientW: number;
      over: string[];
      escaped: string[];
    };
    const notes = [
      r.overflows ? `OVERFLOW ${r.scrollW}>${r.clientW}` : "",
      r.escaped.length ? `${r.escaped.length} ESCAPED` : "",
    ].filter(Boolean);
    console.log(`${w}  ${name.padEnd(15)} ${notes.length ? notes.join(" ") : "ok"}`);
    if (!notes.length) continue;
    bad++;
    for (const o of r.over) console.log(`        overflow: ${o}`);
    for (const e of r.escaped) console.log(`        escaped:  ${e}`);
    await page.screenshot({ path: `${out}/overflow-${name}-${w}.png` });
  }
}
await browser.close();
console.log(bad ? `\n${bad} surface/width combinations have a containment problem` : "\nnothing overflows and nothing escapes its box");

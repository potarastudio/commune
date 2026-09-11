/**
 * Boots the compiled shell against the web dev server and exercises what a
 * browser tab cannot: the sign-in handoff, the badge, notifications, the
 * screen-share picker, close-to-hide, and external links.
 *   pnpm smoke        (web app running on :3001, local Supabase seeded)
 *
 * shell.openExternal is stubbed so the run never opens your real browser;
 * what it would have opened is asserted instead.
 */
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const DEV = "http://localhost:3001";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

type Row = { name: string; ok: boolean | null; detail: string };

/** Poll a condition across navigations, which would break a page-side waitForFunction. */
async function pollUntil(cond: () => Promise<boolean>, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
/** Evaluate in the page, retrying if a navigation destroys the context mid-call. */
async function evalRetry<T>(page: Page, fn: () => T | Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      if (i >= tries - 1 || !/context was destroyed|navigation/i.test(String(e))) throw e;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}
const rows: Row[] = [];
const check = (name: string, ok: boolean, detail = "") => rows.push({ name, ok, detail });
const note = (name: string, detail: string) => rows.push({ name, ok: null, detail });

// ---- a "system browser" that signs in and mints a handoff -----------------------

async function browserCookie(): Promise<string> {
  const login = await fetch(`${DEV}/auth/dev-login?email=hi@potarastudio.com`, { redirect: "manual" });
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie.includes("auth-token")) throw new Error("dev-login set no session cookie; is the local stack seeded?");
  return cookie;
}

async function mintHandoff(): Promise<string> {
  const cookie = await browserCookie();
  const page = await fetch(`${DEV}/desktop/handoff`, { headers: { cookie }, redirect: "manual" });
  const html = await page.text();
  const id = /commune:\/\/auth\?handoff=([0-9a-f-]{36})/.exec(html)?.[1];
  if (!id) throw new Error(`handoff page carried no id (status ${page.status})`);
  return `commune://auth?handoff=${id}`;
}

// ---- run ---------------------------------------------------------------------------

const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
try {
  execFileSync("psql", [DB, "-Atq", "-c", "update huddle_participants set left_at = now() where left_at is null", "-c", "update huddles set ended_at = now() where ended_at is null"]);
} catch {
  console.error("Could not reset huddle state; is the local Supabase stack running?");
  process.exit(2);
}

const ping = await fetch(`${DEV}/login`).catch(() => null);
if (!ping || ping.status !== 200) {
  console.error(`The web app is not running on ${DEV}. Start it with \`pnpm dev\` in the repo root.`);
  process.exit(2);
}

const app: ElectronApplication = await electron.launch({
  executablePath: require("electron") as string,
  args: [path.join(root, "dist/main.js"), "--use-fake-device-for-media-stream"],
  // A throwaway profile: a previous run's session must not sign this one in.
  env: { ...process.env, COMMUNE_DEV: "1", COMMUNE_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "commune-smoke-")) },
  timeout: 60_000,
});

// Never open the real browser from a test; record what would have opened.
await app.evaluate(({ shell }) => {
  const opened: string[] = [];
  (globalThis as { __opened?: string[] }).__opened = opened;
  shell.openExternal = async (url: string) => {
    opened.push(url);
  };
});
const opened = () => app.evaluate(() => (globalThis as { __opened?: string[] }).__opened ?? []);

const stderr: string[] = [];
app.process().stderr?.on("data", (d: Buffer) => stderr.push(String(d)));
const win: Page = await app.firstWindow({ timeout: 60_000 });
const errors: string[] = [];
win.on("pageerror", (e) => errors.push(e.message.split("\n")[0].slice(0, 100)));
await win.waitForLoadState("networkidle");
await win.waitForTimeout(1500);

// 1. Signed out: the login page shows in the window, told to finish on the handoff route.
{
  const url = new URL(win.url());
  check("signed-out window shows /login", url.pathname === "/login", url.pathname);
  check("login is told to finish on the handoff route", url.searchParams.get("next") === "/desktop/handoff", url.search);
}

// 2. The page can tell it is in the shell, and cannot reach Node.
{
  const ua = await win.evaluate(() => navigator.userAgent);
  const pkg = require(path.join(root, "package.json")) as { version: string };
  check("user agent carries the shell version", ua.endsWith(`CommuneDesktop/${pkg.version}`), ua.slice(-28));
  const keys = await win.evaluate(() => Object.keys((window as { communeDesktop?: object }).communeDesktop ?? {}).sort());
  check("bridge exposes exactly the contract", keys.join(",") === "notify,onNavigate,platform,signIn,version", keys.join(","));
  const leak = await win.evaluate(() => typeof (globalThis as { process?: unknown }).process !== "undefined" || typeof (globalThis as { require?: unknown }).require !== "undefined");
  check("no Node in the page", !leak);
}

// 3. Sign-in hands the login page to the browser. Google is PKCE, so the
//    flow must start and finish in the same client; the window never starts it.
{
  const before = (await opened()).length;
  await win.getByRole("button", { name: /google/i }).first().click();
  await win.waitForTimeout(2000);
  const links = await opened();
  const last = links[links.length - 1] ?? "";
  check("Google button opens the login page in the browser, pointed at the handoff", links.length > before && last === `${DEV}/login?next=%2Fdesktop%2Fhandoff`, last.slice(-45));
  check("no OAuth was started from the window", !links.some((l) => l.includes("/auth/v1/authorize")));
  check("the window stayed on /login", new URL(win.url()).pathname === "/login", new URL(win.url()).pathname);
  const cookie = await browserCookie();
  const r = await fetch(`${DEV}/login?next=%2Fdesktop%2Fhandoff`, { headers: { cookie }, redirect: "manual" });
  check("a browser already signed in skips straight to the handoff", r.status === 307 && (r.headers.get("location") ?? "").endsWith("/desktop/handoff"), `${r.status} → ${r.headers.get("location")}`);
}

// 4. The deep link signs the window in.
{
  const link = await mintHandoff();
  await app.evaluate(({ app }, url) => app.emit("open-url", { preventDefault() {} }, url), link);
  const signedIn = await pollUntil(async () => {
    const p = new URL(win.url()).pathname;
    if (p === "/login") return false;
    return win.evaluate(() => document.body.innerText.includes("Potara Studio")).catch(() => false);
  }, 30_000);
  check("deep link → signed in", signedIn, new URL(win.url()).pathname);
  await win.waitForLoadState("networkidle").catch(() => {});
  await win.waitForTimeout(1500);
}

// 5. Badge follows the title.
{
  await evalRetry(win, () => void (document.title = "(3) Commune"));
  await win.waitForTimeout(400);
  const three = await app.evaluate(({ app }) => app.getBadgeCount());
  await evalRetry(win, () => void (document.title = "Commune"));
  await win.waitForTimeout(400);
  const zero = await app.evaluate(({ app }) => app.getBadgeCount());
  if (process.platform === "darwin") check("dock badge tracks the unread count", three === 3 && zero === 0, `${three} → ${zero}`);
  else note("badge", "overlay icon path; verified on macOS only");
}

// 6. Notification IPC round-trips and honours focus.
{
  const focused = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFocused() ?? false);
  const shown = await evalRetry(win, () =>
    (window as unknown as { communeDesktop: { notify: (p: object) => Promise<boolean> } }).communeDesktop.notify({ title: "Smoke", body: "hello", url: "/saved" }),
  );
  check("notify() answers, and only shows when the window is not focused", shown === !focused, `focused=${focused} shown=${shown}`);
}

// 7. A notification click navigates in-page.
{
  const got = win.evaluate(
    () =>
      new Promise<string>((resolve) => {
        (window as unknown as { communeDesktop: { onNavigate: (cb: (u: string) => void) => void } }).communeDesktop.onNavigate(resolve);
      }),
  );
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.send("desktop:navigate", "/saved"));
  const url = await Promise.race([got, new Promise<string>((r) => setTimeout(() => r("timeout"), 5000))]);
  check("onNavigate delivers the target", url === "/saved", url);
  await win.waitForURL((u) => u.pathname === "/saved", { timeout: 15_000 }).catch(() => {});
  check("…and the page followed it", new URL(win.url()).pathname === "/saved", new URL(win.url()).pathname);
}

// 8. Screen share: the huddle's share button opens our picker.
{
  await win.locator('a[href^="/channel/"]').first().click();
  await win.waitForLoadState("networkidle");
  await win.getByRole("button", { name: /^(huddle|join)/i }).first().click();
  await win.locator('aside[aria-label*="Huddle in"]').waitFor({ timeout: 30_000 });
  check("huddle connects (dock visible)", true);

  const probe = await app.evaluate(async ({ desktopCapturer }) => {
    const t = Date.now();
    const s = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 32, height: 20 } });
    return { sources: s.length, ms: Date.now() - t };
  });
  note("desktopCapturer.getSources", `${probe.sources} source(s) in ${probe.ms} ms`);
  await win.evaluate(() => {
    const md = navigator.mediaDevices;
    const orig = md.getDisplayMedia.bind(md);
    const w = window as unknown as { __gdm: string };
    w.__gdm = "not called";
    md.getDisplayMedia = (c) => {
      w.__gdm = "called";
      return orig(c).then(
        (s) => ((w.__gdm = "resolved"), s),
        (e: Error) => {
          w.__gdm = `rejected: ${e.name}: ${e.message}`;
          throw e;
        },
      );
    };
  });
  const pickerPromise = app.waitForEvent("window", { timeout: 20_000 }).catch(() => null);
  await win.getByRole("button", { name: "Share screen" }).click();
  const picker = await pickerPromise;
  check("share opens the picker window", picker !== null, picker ? await picker.title() : "no window");
  if (picker) {
    await picker.waitForLoadState("domcontentloaded");
    const sources = await picker.locator("button.src").count();
    if (sources > 0) {
      // Choosing a source closes the picker mid-click; that is the expected outcome, not a failure.
      await picker.locator("button.src").first().click({ noWaitAfter: true }).catch((e) => {
        if (!/closed/i.test(String(e))) throw e;
      });
      await win.getByRole("button", { name: "Stop sharing" }).waitFor({ timeout: 20_000 }).catch(() => {});
      const sharing = (await win.getByRole("button", { name: "Stop sharing" }).count()) > 0;
      check("picking a source starts sharing", sharing, `${sources} source(s) listed`);
    } else {
      note("screen sources", "none listed: macOS Screen Recording permission not granted to this Electron; the empty state showed");
      await picker.getByRole("button", { name: "Cancel" }).click().catch(() => {});
    }
  }
  note("getDisplayMedia", await win.evaluate(() => (window as unknown as { __gdm: string }).__gdm));
  await win.getByRole("button", { name: /^leave/i }).first().click().catch(() => {});
  await win.waitForTimeout(1000);
}

// 9. Closing hides; activating brings it back; the app keeps running.
{
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await win.waitForTimeout(500);
  const state = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { alive: Boolean(w && !w.isDestroyed()), visible: w?.isVisible() ?? false };
  });
  check("close hides the window and keeps the app alive", state.alive && !state.visible, JSON.stringify(state));
  await app.evaluate(({ app }) => app.emit("activate"));
  await win.waitForTimeout(500);
  const back = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false);
  check("activate shows it again", back);
}

// 10. Links off the site open in the browser and never in the window.
{
  const before = (await opened()).length;
  await win.evaluate(() => void window.open("https://example.com/off-site"));
  await win.waitForTimeout(800);
  const links = await opened();
  const windows = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  check("external link goes to the browser", links.length === before + 1 && links.at(-1)?.startsWith("https://example.com"), `${windows} window(s)`);
}

check("no page errors during the run", errors.length === 0, errors.join(" | "));
const noise = stderr.join("").split("\n").filter((l) => l.trim() && !/Secure coding|NSApplication|ApplePersistence|CoreText|IMK|WARNING:|p2p\/socket_manager|Failed to resolve address/.test(l));
if (noise.length) note("main-process stderr", noise.slice(0, 4).join(" | ").slice(0, 300));

await app.close();

// ---- report ----------------------------------------------------------------------
let failed = 0;
for (const r of rows) {
  const mark = r.ok === null ? "·" : r.ok ? "✓" : "✗";
  if (r.ok === false) failed++;
  console.log(`${mark} ${r.name}${r.detail ? `   ${r.detail}` : ""}`);
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);

/**
 * Boots the compiled shell against the web dev server and exercises what a
 * browser tab cannot: the sign-in handoff, the badge, notifications, the
 * screen-share picker, close-to-hide, and external links.
 *   pnpm smoke        (web app running on :3001, local Supabase seeded)
 *   COMMUNE_DEV_URL   point the shell and this run at another port, when 3001 is taken
 *   SMOKE_VERBOSE=1   prints each result as it happens, to see how far a crashed run got
 *   SMOKE_SHOTS=<dir> saves a screenshot of the screen-share picker there
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

const DEV = process.env.COMMUNE_DEV_URL ?? "http://localhost:3001";
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
// SMOKE_VERBOSE=1 prints each row as it happens, which shows how far a crashed run got.
const verbose = (row: Row) => process.env.SMOKE_VERBOSE && console.error(`${row.ok === null ? "·" : row.ok ? "✓" : "✗"} ${row.name}   ${row.detail}`);
const check = (name: string, ok: boolean, detail = "") => {
  rows.push({ name, ok, detail });
  verbose(rows[rows.length - 1]);
};
const note = (name: string, detail: string) => {
  rows.push({ name, ok: null, detail });
  verbose(rows[rows.length - 1]);
};

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
// Record where each error happened and the React diff, not just the first line:
// "hydration failed" alone does not say which page or which text.
win.on("pageerror", (e) => {
  let where = "?";
  try {
    where = new URL(win.url()).pathname;
  } catch {}
  const diff = e.message.split("\n").filter((l) => /^\s*[+-] /.test(l)).slice(0, 4).join(" / ");
  errors.push(`${where}: ${e.message.split("\n")[0].slice(0, 90)}${diff ? "  [" + diff.replace(/\s+/g, " ").slice(0, 220) + "]" : ""}`);
});
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
  check("Google button opens sign-in in the browser, pointed at the handoff", links.length > before && last === `${DEV}/auth/google?next=%2Fdesktop%2Fhandoff`, last.slice(-45));
  check("no OAuth was started from the window", !links.some((l) => l.includes("/auth/v1/authorize")));
  check("the window stayed on /login", new URL(win.url()).pathname === "/login", new URL(win.url()).pathname);
  const cookie = await browserCookie();
  const signedInHop = await fetch(`${DEV}/auth/google?next=%2Fdesktop%2Fhandoff`, { headers: { cookie }, redirect: "manual" });
  check(
    "a browser already signed in skips straight to the handoff",
    signedInHop.status === 307 && (signedInHop.headers.get("location") ?? "").endsWith("/desktop/handoff"),
    `${signedInHop.status} → ${signedInHop.headers.get("location")}`,
  );
  const fresh = await fetch(`${DEV}/auth/google?next=%2Fdesktop%2Fhandoff`, { redirect: "manual" });
  // Supabase's authorize endpoint is the first hop; it forwards to Google's account chooser.
  const toGoogle = fresh.headers.get("location") ?? "";
  check("a signed-out browser starts Google sign-in, not Commune's login page", fresh.status === 307 && toGoogle.includes("/auth/v1/authorize?provider=google"), toGoogle.slice(0, 52));
  // Apps installed before this route existed still open /login; it forwards them.
  const old = await fetch(`${DEV}/login?next=%2Fdesktop%2Fhandoff`, { redirect: "manual" });
  check("the older app's login link forwards to Google too", old.status === 307 && (old.headers.get("location") ?? "").includes("/auth/google"), `${old.status} → ${old.headers.get("location")}`);
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

// 6b. A real message in a channel set to "All new messages" rings and announces
//     itself while the window is in the background, which is the whole point of
//     the app.
{
  // Somewhere other than the channel the message lands in: a message you are
  // already reading, in front, is not worth interrupting yourself over.
  const elsewhere = execFileSync("psql", [DB, "-Atq", "-c", "select id from channels where name = 'design'"], { encoding: "utf8" }).trim();
  await win.goto(`${DEV}/channel/${elsewhere}`, { waitUntil: "networkidle" }).catch(() => {});
  await win.waitForTimeout(2500);
  // Chrome only allows sound after a gesture, and the spy has to outlive the navigation.
  await win.mouse.click(5, 5).catch(() => {});
  // A string, not a function: tsx would wrap a function's inner arrows in a __name helper the page lacks.
  await win.evaluate(
    `(function(){ window.__sounds = 0; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
       ["createOscillator","createBufferSource"].forEach(function (m) { var o = AC.prototype[m];
         AC.prototype[m] = function () { window.__sounds++; return o.apply(this, arguments); }; }); })()`,
  );
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.blur());

  const marker = `smoke notify ${Math.random().toString(36).slice(2, 8)}`;
  const doc = `jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','${marker}')))))`;
  execFileSync("psql", [DB, "-Atq", "-c",
    `insert into messages (channel_id, author_id, content, content_text) select c.id, p.id, ${doc}, '${marker}' from channels c, profiles p where c.name = 'general' and p.email = 'sari@potara.studio'`]);

  const rang = await pollUntil(async () => (await win.evaluate(() => (window as unknown as { __sounds?: number }).__sounds ?? 0)) > 0, 20_000);
  const state = await win.evaluate(() => ({
    sounds: (window as unknown as { __sounds?: number }).__sounds ?? 0,
    path: location.pathname,
    focus: document.hasFocus(),
    toasts: document.querySelectorAll("[data-sonner-toast]").length,
  }));
  const toast = (await win.locator("[data-sonner-toast]").last().textContent().catch(() => "")) ?? "";
  check("a message in a channel set to all messages rings", rang, JSON.stringify(state));
  check("…and says who sent it and where", /sari/i.test(toast) && /general/i.test(toast), toast.slice(0, 60));
  execFileSync("psql", [DB, "-Atq", "-c", `delete from messages where content_text = '${marker}'`]);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  await win.waitForTimeout(1000);
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
  type PickerWindow = { __renders?: number };
  const openPicker = async (): Promise<Page | null> => {
    const opened = app.waitForEvent("window", { timeout: 20_000 }).catch(() => null);
    await win.getByRole("button", { name: "Share screen" }).click();
    const picker = await opened;
    if (!picker) return null;
    await picker.waitForLoadState("domcontentloaded");
    await picker.waitForFunction(() => ((window as unknown as PickerWindow).__renders ?? 0) > 0, undefined, { timeout: 20_000 }).catch(() => {});
    return picker;
  };
  const gdm = () => win.evaluate(() => (window as unknown as { __gdm: string }).__gdm);

  const picker = await openPicker();
  check("share opens Commune's picker window", picker !== null, picker ? await picker.title() : "no window");
  if (picker) {
    const listed = await picker.getByRole("radio").count();
    if (listed > 0) {
      const screens = await picker.locator("#screens-grid .src").count();
      const windows = await picker.locator("#windows-grid .src").count();
      check("it lists screens and windows by name", screens > 0, `${screens} screen(s), ${windows} window(s)`);

      const ownIds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
      const offered = await picker.locator(".src").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id ?? ""));
      check("Commune's own windows are not offered", !offered.some((id) => ownIds.includes(id)), `${ownIds.length} own window(s) left out`);
      check("Share waits for a choice", await picker.locator("#share").isDisabled());

      await picker.locator("#search").fill("zzzz no such window");
      const noMatch = (await picker.locator("#no-match").isVisible()) && (await picker.locator("#list .src:visible").count()) === 0;
      check("search narrows the list", noMatch, (await picker.locator("#no-match").textContent()) ?? "");
      await picker.locator("#search").fill("");

      // A refresh is a 3 s pause plus a fresh getSources, which alone takes a second or more.
      const before = await picker.evaluate(() => (window as unknown as PickerWindow).__renders ?? 0);
      await picker.waitForFunction((n) => ((window as unknown as PickerWindow).__renders ?? 0) > n, before, { timeout: 12_000 }).catch(() => {});
      const after = await picker.evaluate(() => (window as unknown as PickerWindow).__renders ?? 0);
      check("thumbnails refresh while it is open", after > before, `${before} → ${after} renders`);

      await picker.locator("#screens-grid .src").first().click();
      const armed = (await picker.locator("#share").isEnabled()) && (await picker.locator("#share").textContent()) === "Share screen";
      check("choosing a screen arms Share", armed, (await picker.locator("#share").textContent()) ?? "");
      if (process.env.SMOKE_SHOTS) await picker.screenshot({ path: path.join(process.env.SMOKE_SHOTS, "share-picker.png") });

      // Escape is a change of mind: nothing is shared and the page stays error-free.
      const closed = picker.waitForEvent("close", { timeout: 10_000 }).catch(() => null);
      // The picker closes on keydown, before Playwright sends keyup; that is the expected outcome.
      await picker.keyboard.press("Escape").catch((e) => {
        if (!/closed/i.test(String(e))) throw e;
      });
      await closed;
      await pollUntil(async () => (await gdm()).startsWith("rejected"), 8000);
      const cancelled = (await gdm()).startsWith("rejected") && (await win.getByRole("button", { name: "Stop sharing" }).count()) === 0;
      check("Escape closes it without sharing", cancelled, await gdm());
      await win.waitForTimeout(800);
      const toasts = await win.locator("[data-sonner-toast]").allTextContents();
      check("…and without an error toast", !toasts.some((t) => /couldn|blocked/i.test(t)), toasts.join(" | ") || "none");

      const again = await openPicker();
      if (again) {
        await again.locator("#screens-grid .src").first().click();
        // Sharing closes the picker mid-click; that is the expected outcome, not a failure.
        await again.locator("#share").click({ noWaitAfter: true }).catch((e) => {
          if (!/closed/i.test(String(e))) throw e;
        });
        await win.getByRole("button", { name: "Stop sharing" }).waitFor({ timeout: 20_000 }).catch(() => {});
        const sharing = (await win.getByRole("button", { name: "Stop sharing" }).count()) > 0;
        check("Share screen starts sharing", sharing, `${listed} source(s) listed`);
        if (sharing) await win.getByRole("button", { name: "Stop sharing" }).click();
      } else {
        check("the picker opens a second time", false);
      }
    } else {
      const blocked = await picker.locator("#blocked").isVisible();
      note("screen sources", blocked ? "none listed: Screen Recording is not granted to this Electron, and the picker explained how to allow it" : "none listed");
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

// 11. A window that loses its page comes back, rather than showing nothing.
//     Hidden for hours, a renderer can be reclaimed by macOS; the window then
//     sits blank with its old title.
{
  const pageText = () =>
    app
      .evaluate(async ({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0];
        if (!w || w.isDestroyed()) return "no window";
        if (w.webContents.isCrashed()) return "crashed";
        if (w.webContents.isLoading()) return "loading";
        const text = (await w.webContents.executeJavaScript("document.body.innerText.trim().slice(0, 30)")) as string;
        return text || "blank";
      })
      .catch((e: Error) => `unreachable: ${e.message.slice(0, 40)}`);
  const recovered = async () => {
    const text = await pageText();
    return !["crashed", "blank", "loading", "no window"].includes(text) && !text.startsWith("unreachable");
  };

  // The event macOS's reclaim raises, rather than a real crash: killing the
  // renderer breaks Playwright's own connection to it for the rest of the run.
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w?.webContents.executeJavaScript("document.body.innerHTML = ''");
    w?.webContents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 133 });
  });
  check("a page process that dies is reloaded, not left blank", await pollUntil(recovered, 40_000), await pageText());

  // Past the guard that stops a failing page reloading over and over.
  await win.waitForTimeout(9000).catch(() => new Promise((r) => setTimeout(r, 9000)));

  // Alive but empty, which is what a frozen page looks like when it is shown again.
  await app
    .evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript("document.body.innerHTML = ''"))
    .catch(() => {});
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w?.hide();
    w?.show();
  });
  check("a window shown with an empty page reloads it", await pollUntil(recovered, 40_000), await pageText());
}

check("no page errors during the run", errors.length === 0, errors.join(" | "));
const noise = stderr.join("").split("\n").filter((l) => l.trim() && !/Secure coding|NSApplication|ApplePersistence|CoreText|IMK|WARNING:|p2p\/socket_manager|Failed to resolve address|reloading the window/.test(l));
const rejection = noise.find((l) => /UnhandledPromiseRejection/.test(l));
check("no unhandled rejections in the main process", !rejection, rejection?.slice(0, 160) ?? "");
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

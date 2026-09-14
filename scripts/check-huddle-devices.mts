// Dev check: the huddle's audio and video settings list the real devices,
// switch the live track when one is picked, work in full screen, and are
// remembered for the next huddle. Screen share asks the browser for tabs,
// sound, and not Commune's own tab.
//   node --import tsx scripts/check-huddle-devices.mts   (dev server on 3001, LiveKit env set)
//   SHOTS=<dir> also saves screenshots of the open menus in light and dark.
//
// Chromium's fake devices stand in for hardware: three microphones
// ("Fake Default Audio Input", "Fake Audio Input 1" and "2"), matching
// speakers, and two cameras (fake_device_0 and fake_device_1).
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

const DEV = "http://localhost:3001";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const q = (sql: string) => execFileSync("psql", [DB, "-Atc", sql], { encoding: "utf8" }).trim();
const SHOTS = process.env.SHOTS;
const rows: string[] = [];
const ok = (label: string, pass: boolean, detail = "") => rows.push(`${pass ? "✓" : "✗"} ${label}${detail ? "   " + detail : ""}`);

type Gum = { audio: string; video: string; tracks: { kind: string; label: string; deviceId: string }[] };

// A string, so tsx does not wrap the page code in helpers the page lacks.
const RECORD_MEDIA = `(function () {
  var md = navigator.mediaDevices; if (!md) return;
  var gum = md.getUserMedia.bind(md); var gdm = md.getDisplayMedia && md.getDisplayMedia.bind(md);
  window.__gum = []; window.__gdm = [];
  md.getUserMedia = function (c) {
    return gum(c).then(function (s) {
      window.__gum.push({ audio: JSON.stringify((c && c.audio) || null), video: JSON.stringify((c && c.video) || null),
        tracks: s.getTracks().map(function (t) { return { kind: t.kind, label: t.label, deviceId: t.getSettings().deviceId || "" }; }) });
      return s;
    });
  };
  if (gdm) md.getDisplayMedia = function (c) { window.__gdm.push(JSON.stringify(c || null)); return gdm(c); };
})();`;

const gums = (page: Page) => page.evaluate(() => (window as unknown as { __gum: Gum[] }).__gum);
const lastTrack = async (page: Page, kind: "audio" | "video") => (await gums(page)).flatMap((g) => g.tracks).filter((t) => t.kind === kind).at(-1);
const prefs = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem("commune-huddle-devices") ?? "{}") as { state?: Record<string, { id: string; label: string }> }).state ?? {});

async function waitFor(cond: () => Promise<boolean>, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** Moves the pointer off the controls, so a tooltip isn't mid-fade, and lets the menu finish opening. */
async function shoot(page: Page, file: string) {
  await page.mouse.move(720, 120);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS!, file) });
}

async function joinHuddle(page: Page) {
  await page.getByRole("button", { name: /^(huddle|join)/i }).first().click();
  await page.locator('aside[aria-label*="Huddle in"]').waitFor({ timeout: 30_000 });
  await waitFor(async () => Boolean(await lastTrack(page, "audio")));
}

async function leaveHuddle(page: Page) {
  await page.getByRole("button", { name: "Leave huddle" }).first().click().catch(() => {});
  await page.locator('aside[aria-label*="Huddle in"]').waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
}

async function signedIn(browser: import("@playwright/test").Browser, theme: "light" | "dark"): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  await ctx.addInitScript({ content: RECORD_MEDIA });
  const page = await ctx.newPage();
  await page.goto(`${DEV}/auth/dev-login?email=hi@potarastudio.com`, { waitUntil: "networkidle" });
  await page.goto(`${DEV}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" }).click().catch(() => {});
  const general = q("select id from channels where name='general'");
  await page.goto(`${DEV}/channel/${general}`, { waitUntil: "networkidle" });
  return [ctx, page];
}

const resetHuddles = () => {
  q("update huddle_participants set left_at = now() where left_at is null");
  q("update huddles set ended_at = now() where ended_at is null");
};

resetHuddles();
const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream=device-count=2", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const errors: string[] = [];

try {
  const [ctx, page] = await signedIn(browser, "light");
  const noteError = (msg: string) => {
    const tail = msg.split("hydration-mismatch").slice(1).join("").split("\n");
    const at = tail.findIndex((l) => /^\s*[+-]\s/.test(l));
    const diff = at < 0 ? "" : tail.slice(Math.max(0, at - 6), at + 3).map((l) => l.trim()).join(" / ");
    errors.push(`${new URL(page.url()).pathname}: ${msg.split("\n")[0].slice(0, 90)}${diff ? `  [${diff.slice(0, 700)}]` : ""}`);
  };
  page.on("pageerror", (e) => noteError(e.message));
  page.on("console", (m) => m.type() === "error" && /hydrat/i.test(m.text()) && noteError(m.text()));
  await joinHuddle(page);
  ok("a huddle starts with the fake microphone", Boolean(await lastTrack(page, "audio")), (await lastTrack(page, "audio"))?.label);

  // 1. Audio settings: microphones and speakers, a live level, and a real switch.
  await page.getByRole("button", { name: "Audio settings" }).click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  const mics = await menu.getByRole("group", { name: "Microphone" }).getByRole("menuitemradio").allTextContents();
  const speakers = await menu.getByRole("group", { name: "Speaker" }).getByRole("menuitemradio").allTextContents();
  ok("Audio settings lists every microphone, the system default first", mics.length === 3 && mics[0].startsWith("System default") && mics.includes("Fake Audio Input 2"), mics.join(" | "));
  ok("…and every speaker", speakers.length >= 2 && speakers.some((s) => s.startsWith("Fake Audio Output")), speakers.join(" | "));
  const moved = await waitFor(async () => Number(await menu.locator("[data-level]").getAttribute("data-level")) > 0, 8000);
  ok("the level meter moves with the microphone", moved);
  if (SHOTS) await shoot(page, "huddle-audio-menu-light.png");

  const before = (await gums(page)).length;
  await menu.getByRole("menuitemradio", { name: /^Fake Audio Input 2/ }).click();
  await waitFor(async () => (await gums(page)).length > before);
  const mic = await lastTrack(page, "audio");
  ok("picking a microphone switches the live track to it", mic?.label === "Fake Audio Input 2", mic?.label);

  await page.getByRole("button", { name: "Audio settings" }).click();
  const checkedMic = await page.getByRole("menu").getByRole("menuitemradio", { checked: true }).first().textContent();
  ok("…and the menu shows it checked next time", checkedMic === "Fake Audio Input 2", checkedMic ?? "");
  await page.getByRole("menu").getByRole("menuitemradio", { name: /^Fake Audio Output 1/ }).click();
  const saved = await prefs(page);
  ok(
    "the microphone and speaker are remembered on this device, by id and name",
    saved.audioinput?.id === mic?.deviceId && saved.audioinput?.label === "Fake Audio Input 2" && Boolean(saved.audiooutput?.id) && saved.audiooutput?.id !== "default",
  );

  // 2. Video settings: cameras, switching the live camera.
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await waitFor(async () => Boolean(await lastTrack(page, "video")));
  await page.getByRole("button", { name: "Video settings" }).click();
  const cameras = await page.getByRole("menu").getByRole("menuitemradio").allTextContents();
  ok("Video settings lists the cameras", cameras.length === 2 && cameras.includes("fake_device_1"), cameras.join(" | "));
  if (SHOTS) await shoot(page, "huddle-video-menu-light.png");
  const beforeCam = (await gums(page)).length;
  await page.getByRole("menu").getByRole("menuitemradio", { name: "fake_device_1" }).click();
  await waitFor(async () => (await gums(page)).length > beforeCam);
  const cam = await lastTrack(page, "video");
  ok("picking a camera switches the live camera", cam?.label === "fake_device_1", cam?.label);
  ok("…and is remembered", (await prefs(page)).videoinput?.id === cam?.deviceId);
  await page.getByRole("button", { name: "Turn camera off" }).click();

  // 3. Screen share asks for tabs with sound, and leaves Commune's own tab out.
  await page.getByRole("button", { name: "Share screen" }).click();
  await waitFor(async () => (await page.evaluate(() => (window as unknown as { __gdm: string[] }).__gdm.length)) > 0, 8000);
  const asked = JSON.parse((await page.evaluate(() => (window as unknown as { __gdm: string[] }).__gdm))[0] ?? "{}") as Record<string, unknown>;
  ok(
    "screen share asks for sound and tab switching, without Commune's tab",
    Boolean(asked.audio) && asked.selfBrowserSurface === "exclude" && asked.surfaceSwitching === "include" && asked.systemAudio === "include",
    JSON.stringify({ audio: Boolean(asked.audio), selfBrowserSurface: asked.selfBrowserSurface, surfaceSwitching: asked.surfaceSwitching, systemAudio: asked.systemAudio }),
  );
  await page.getByRole("button", { name: "Stop sharing" }).click({ timeout: 3000 }).catch(() => {});

  // 4. Full screen: the menu opens inside the stage, where it can be seen.
  // The stage's own Full screen button only appears while a screen is shared, which headless
  // Chromium can't do, so a real click on a stand-in button supplies the gesture it needs.
  await page.getByRole("link", { name: "Expand huddle" }).first().click();
  await page.getByRole("link", { name: "Minimise to dock" }).waitFor();
  await page.locator('aside[aria-label*="Huddle in"]').waitFor({ state: "detached" });
  await page.evaluate(`(function(){var b=document.createElement("button");b.id="fs-probe";b.textContent="fs";b.style.cssText="position:fixed;top:0;left:0;z-index:99999";b.onclick=function(){document.querySelector('a[aria-label="Minimise to dock"]').closest(".bg-rail").requestFullscreen()};document.body.appendChild(b)})()`);
  await page.locator("#fs-probe").click();
  const full = await waitFor(async () => page.evaluate(() => Boolean(document.fullscreenElement)), 5000);
  await page.getByRole("button", { name: "Audio settings" }).click();
  await page.getByRole("menu").waitFor();
  const inside = await page.evaluate(() => Boolean(document.fullscreenElement?.contains(document.querySelector('[role="menu"]'))));
  ok("in full screen the menu opens inside the stage", full && inside, full ? "" : "the stage never went full screen");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.exitFullscreen().catch(() => {}));

  // 5. The next huddle starts on the remembered microphone.
  await leaveHuddle(page);
  resetHuddles();
  await page.goto(`${DEV}/channel/${q("select id from channels where name='general'")}`, { waitUntil: "networkidle" });
  await joinHuddle(page);
  // Joining may open the default first and move across once the browser shows device ids.
  await waitFor(async () => (await lastTrack(page, "audio"))?.label === "Fake Audio Input 2", 10_000);
  const rejoined = await lastTrack(page, "audio");
  ok("the next huddle starts on the remembered microphone", rejoined?.label === "Fake Audio Input 2", rejoined?.label);
  await leaveHuddle(page);
  await ctx.close();

  // 6. Dark theme: the chrome and its menus stay dark.
  if (SHOTS) {
    resetHuddles();
    const [dctx, dpage] = await signedIn(browser, "dark");
    await joinHuddle(dpage);
    await dpage.getByRole("button", { name: "Audio settings" }).click();
    await dpage.getByRole("menu").waitFor();
    await dpage.waitForTimeout(1200);
    await shoot(dpage, "huddle-audio-menu-dark.png");
    await dpage.keyboard.press("Escape");
    // Wait for the stage to replace the dock, or these clicks land on the dock as it leaves.
    await dpage.getByRole("link", { name: "Expand huddle" }).first().click();
    await dpage.getByRole("link", { name: "Minimise to dock" }).waitFor();
    await dpage.locator('aside[aria-label*="Huddle in"]').waitFor({ state: "detached" });
    await dpage.getByRole("button", { name: "Turn camera on" }).click();
    await waitFor(async () => Boolean(await lastTrack(dpage, "video")));
    await dpage.getByRole("button", { name: "Video settings" }).click();
    await dpage.getByRole("menu").waitFor();
    await shoot(dpage, "huddle-stage-video-menu-dark.png");
    await dpage.keyboard.press("Escape");
    await leaveHuddle(dpage);
    await dctx.close();
  }
} catch (e) {
  ok("run", false, String(e).split("\n")[0].slice(0, 200));
} finally {
  await browser.close();
  resetHuddles();
  ok("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log(rows.join("\n"));
}
process.exit(rows.some((r) => r.startsWith("✗")) ? 1 : 0);

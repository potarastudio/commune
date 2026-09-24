// Dev check: the phone interface (components/mobile, design/Commune Mobile *).
//
//   pnpm dev                     (the local stack, seeded)
//   node --import tsx scripts/check-mobile.mts [outDir]
//
// Signs in as Hakim with an iPhone's user agent at 390×844 — the server picks
// the phone shell from the user agent, so the viewport alone would not — and
// visits every phone screen in light and in dark, saving a screenshot of each
// (outDir, default a temp folder). Any console error, page error or hydration
// warning fails the run. Then it walks the navigation model: every tab, a
// push into a channel (the tab bar must go), the header's Back and the
// browser's Back.
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEV = "http://localhost:3001";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const out = process.argv[2] ?? join(tmpdir(), "commune-mobile");
mkdirSync(out, { recursive: true });

const problems: string[] = [];
let where = "";
const browser = await chromium.launch();

async function phone(theme: "light" | "dark") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: IPHONE, hasTouch: true, isMobile: true, colorScheme: theme });
  const page = await ctx.newPage();
  // Next's dev badge sits on the Channels tab; it is not part of the app. (Styles only: a
  // function handed to the browser would carry tsx's __name helper, which the page lacks.)
  page.on("load", () => void page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {}));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(`[${theme} ${where}] console.${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${theme} ${where}] ${e.message.slice(0, 400)}`));
  return { ctx, page };
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
}

for (const theme of ["light", "dark"] as const) {
  // Signed out first: the phone's sign-in.
  {
    const { ctx, page } = await phone(theme);
    where = "/login";
    await page.goto(`${DEV}/login`);
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);
    await page.reload();
    await settle(page);
    await page.screenshot({ path: join(out, `${theme}-login.png`) });
    await ctx.close();
  }

  const { ctx, page } = await phone(theme);
  await page.goto(`${DEV}/auth/dev-login?email=hi@potarastudio.com`);
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    localStorage.setItem("commune-tab-hint", "seen");
  }, theme);
  await page.goto(`${DEV}/`);
  await settle(page);
  const design = await page.evaluate(() => [...document.querySelectorAll('a[href^="/channel/"]')].find((a) => a.textContent?.includes("design"))?.getAttribute("href"));
  await page.goto(`${DEV}/dm`);
  const dm = await page.evaluate(() => document.querySelector('a[href^="/dm/"]:not([href="/dm/new"])')?.getAttribute("href"));
  if (!design || !dm) throw new Error("The seed needs #design and at least one DM.");

  const screens: [string, string][] = [
    ["channels", "/"],
    ["activity", "/activity"],
    ["dms", "/dm"],
    ["saved", "/saved"],
    ["you", "/settings"],
    ["notifications", "/settings?section=notifications"],
    ["appearance", "/settings?section=appearance"],
    ["account", "/settings?section=account"],
    ["channel", design],
    ["channel-details", `${design}?panel=details&tab=members`],
    ["dm", dm],
    ["search", "/search?q=type"],
    ["new-message", "/dm/new"],
    ["profile", "/u/sari"],
    ["browse", "/channels"],
  ];
  for (const [name, path] of screens) {
    where = path;
    await page.goto(`${DEV}${path}`);
    await settle(page);
    await page.screenshot({ path: join(out, `${theme}-${name}.png`) });
  }
  await ctx.close();
}

// The navigation model, in a fresh session so no tab is holding a screen open.
{
  const { ctx, page } = await phone("light");
  const url = () => page.evaluate(() => location.pathname + location.search);
  const expect = (what: string, actual: unknown, wanted: unknown) => {
    if (actual !== wanted) problems.push(`[nav] ${what}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`);
  };
  await page.goto(`${DEV}/auth/dev-login?email=hi@potarastudio.com`);
  await settle(page);
  for (const href of ["/activity", "/dm", "/saved", "/settings", "/"]) {
    where = `tab ${href}`;
    // Dispatched to the tab itself: in dev, Next's badge covers the first tab.
    await page.locator(`nav[aria-label="Sections"] a[href="${href}"]`).dispatchEvent("click");
    await page.waitForTimeout(1500);
    expect(`tab ${href}`, await url(), href);
  }
  const design = await page.evaluate(() => [...document.querySelectorAll('a[href^="/channel/"]')].find((a) => a.textContent?.includes("design"))?.getAttribute("href"));
  where = "push";
  await page.locator(`a[href="${design}"]`).dispatchEvent("click");
  await page.waitForTimeout(2500);
  expect("push", await url(), design);
  expect("tab bar on a pushed screen", await page.locator('nav[aria-label="Sections"]').count(), 0);
  where = "back";
  await page.locator('header button[aria-label="Back"]').dispatchEvent("click");
  await page.waitForTimeout(1800);
  expect("header back", await url(), "/");
  await page.locator(`a[href="${design}"]`).dispatchEvent("click");
  await page.waitForTimeout(2000);
  await page.goBack();
  await page.waitForTimeout(1500);
  expect("browser back", await url(), "/");
  await ctx.close();
}

await browser.close();
console.log(`Screenshots in ${out}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Phone screens: no errors, navigation as designed.");

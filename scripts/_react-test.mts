import { chromium } from "@playwright/test";
const [designId, label] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://localhost:3001/auth/dev-login?email=hi@potarastudio.com");
await p.goto(`http://localhost:3001/channel/${designId}`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);

const article = p.locator("article").filter({ hasText: "New Inter release" }).last();
await article.scrollIntoViewIfNeeded();
await article.hover();
await p.waitForTimeout(300);
await article.getByRole("toolbar", { name: "Message actions" }).getByRole("button", { name: "Add reaction" }).click();
const pop = p.getByRole("listbox", { name: "Pick a reaction" });
await pop.waitFor({ timeout: 5000 });

const disp = `(() => { const el = document.querySelector('[data-message-toolbar]') || document.querySelector('[role="toolbar"][aria-label="Message actions"]'); return el ? getComputedStyle(el).display : "no toolbar"; })()`;
console.log(`[${label}] toolbar display while open, pointer on trigger:`, await p.evaluate(disp));

const box = (await pop.boundingBox())!;
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
await p.waitForTimeout(600);
console.log(`[${label}] toolbar display after pointer moves into popover:`, await p.evaluate(disp));
console.log(`[${label}] popover visible:`, await pop.isVisible());

const before = await article.locator("button[aria-pressed]").count();
try {
  await p.getByRole("option", { name: "🎉" }).click({ timeout: 4000 });
  await p.waitForTimeout(1200);
  const after = await article.locator("button[aria-pressed]").count();
  console.log(`[${label}] reaction chips ${before} -> ${after}:`, after > before ? "PICK OK" : "PICK FAILED");
} catch {
  console.log(`[${label}] PICK FAILED — could not click the emoji`);
}
await b.close();

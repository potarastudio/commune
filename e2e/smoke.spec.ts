import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * §8 smoke: sign in (mock OAuth), send a message in #general, see it appear in
 * a second browser context, react to it, reply in thread.
 */
const HAKIM = "hi@potarastudio.com";
const SARI = "sari@potara.studio";

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/auth/dev-login?email=${encodeURIComponent(email)}`);
  await expect(page).toHaveURL(/\/channel\//);
  await expect(page.getByRole("button", { name: /general details/ })).toBeVisible();
  return page;
}

async function send(page: Page, text: string) {
  const composer = page.getByRole("textbox", { name: /Message #general/ });
  await composer.click();
  await composer.fill("");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

test("send, receive live, react and reply in thread", async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const hakim = await signIn(browser, HAKIM);
  const sari = await signIn(browser, SARI);

  // Hakim sends; it appears for him immediately (optimistic) and for Sari via Realtime.
  const text = `Smoke test ${stamp}: hello from Playwright`;
  await send(hakim, text);
  const hakimMessage = hakim.locator("article", { hasText: text }).last();
  await expect(hakimMessage).toBeVisible();
  await expect(hakimMessage).not.toHaveClass(/opacity-60/, { timeout: 15_000 });

  const sariMessage = sari.locator("article", { hasText: text }).last();
  await expect(sariMessage).toBeVisible({ timeout: 15_000 });

  // Sari reacts; both sides show the chip.
  await sariMessage.hover();
  await sariMessage.getByRole("button", { name: "Add reaction" }).first().click();
  await sari.getByRole("option", { name: "👍" }).click();
  await expect(sariMessage.getByRole("button", { name: /👍 1/ })).toBeVisible();
  await expect(hakimMessage.getByRole("button", { name: /👍 1/ })).toBeVisible({ timeout: 15_000 });

  // Sari replies in a thread; Hakim's list shows the reply summary.
  await sariMessage.hover();
  await sariMessage.getByRole("button", { name: "Reply in thread" }).click();
  const panel = sari.getByRole("complementary", { name: "Thread" });
  await expect(panel).toBeVisible();
  const reply = `Reply ${stamp} from Sari`;
  const replyBox = panel.getByRole("textbox", { name: /Reply/ });
  await replyBox.click();
  await sari.keyboard.type(reply);
  await sari.keyboard.press("Enter");
  await expect(panel.locator("article", { hasText: reply })).toBeVisible();
  await expect(hakimMessage.getByRole("button", { name: /Open thread, 1 reply/ })).toBeVisible({ timeout: 15_000 });

  // Hakim opens the thread and sees Sari's reply.
  await hakimMessage.getByRole("button", { name: /Open thread/ }).click();
  await expect(hakim.getByRole("complementary", { name: "Thread" }).locator("article", { hasText: reply })).toBeVisible();

  await hakim.context().close();
  await sari.context().close();
});

test("allowlist rejects unknown accounts", async ({ page }) => {
  // The dev route only mints links for existing users; an unknown email must not create one.
  const response = await page.goto("/auth/dev-login?email=stranger@example.com");
  expect(response?.status()).toBeGreaterThanOrEqual(400);
});

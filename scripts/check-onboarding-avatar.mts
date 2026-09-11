// Dev check: a new teammate who signs in with Google can finish the welcome
// screen, and the avatar rule still refuses someone else's upload.
//   node --import tsx scripts/check-onboarding-avatar.mts   (dev server on 3001)
//
// First sign-in copies the Google photo onto the profile, and the profile
// form sends the avatar back unchanged, so a rule that only accepted the
// user's own uploads left every new Google user stuck on /welcome with "That
// avatar doesn't belong to you." This creates a throwaway allowlisted user
// with a Google photo, finishes setup through the real form, then tampers
// with a Settings save so it claims Hakim's upload and expects a refusal. It
// also saves a Settings change as Hakim, whose local seed avatar is a
// DiceBear URL, and puts it back. The throwaway user is removed at the end.
import { chromium, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
  if (!m || line.trim().startsWith("#")) continue;
  process.env[m[1]] ??= m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}
const DEV = "http://localhost:3001";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const q = (sql: string) => execFileSync("psql", [DB, "-Atc", sql], { encoding: "utf8" }).trim();
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const EMAIL = "probe.newhire@potarastudio.com";
const GOOGLE = "https://lh3.googleusercontent.com/a/probe-photo=s96-c";
const HAKIM = "hi@potarastudio.com";
const rows: string[] = [];
const ok = (label: string, pass: boolean, detail = "") => rows.push(`${pass ? "✓" : "✗"} ${label}${detail ? "   " + detail : ""}`);

// #general's guard refuses the cascade from auth.users, so switch off that one
// trigger for the delete. Never session_replication_role = replica: it also
// stops the foreign-key cascades and leaves orphan profiles and identities.
const purge = () =>
  q(`begin; alter table public.channel_members disable trigger channel_members_guard;
     delete from public.profiles where email='${EMAIL}'; delete from auth.users where email='${EMAIL}';
     delete from public.allowed_emails where email='${EMAIL}';
     alter table public.channel_members enable trigger channel_members_guard; commit;`);

async function waitForReact(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).offsetParent !== null);
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
    },
    selector,
    { timeout: 30_000 },
  );
}

/** Picks a zone in the real Settings form and saves it; returns the text the page shows afterwards. */
async function saveZone(page: Page, zone: string) {
  await page.goto(`${DEV}/settings`, { waitUntil: "networkidle" });
  await waitForReact(page, "select#timezone");
  await page.locator("select#timezone:visible").selectOption(zone);
  await page.getByRole("button", { name: "Save changes" }).click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  return page.evaluate(() => document.body.innerText);
}

const hakimBefore = q(`select timezone || '|' || coalesce(avatar_url, '') from profiles where email='${HAKIM}'`);
const hakimId = q(`select id from profiles where email='${HAKIM}'`);
const browser = await chromium.launch();
purge();

try {
  // 1. A brand-new Google user, with Google's photo copied onto the profile at sign-up.
  await admin.from("allowed_emails").upsert({ email: EMAIL });
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
    user_metadata: { full_name: "Probe Newhire", picture: GOOGLE },
  });
  if (error) throw error;
  const uid = created.user.id;
  const first = q(`select coalesce(avatar_url,'') || '|' || coalesce(onboarded_at::text,'') from profiles where id='${uid}'`);
  ok("first sign-in copies the Google photo and leaves setup unfinished", first === `${GOOGLE}|`, first);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${DEV}/auth/dev-login?email=${EMAIL}`, { waitUntil: "networkidle" });
  await page.goto(`${DEV}/welcome?step=profile`, { waitUntil: "networkidle" });
  const submit = page.getByRole("button", { name: "Start using Commune" });
  await submit.waitFor({ timeout: 30_000 });
  await waitForReact(page, "form button[type=submit]");
  for (let i = 0; i < 40 && !(await submit.isEnabled()); i++) await page.waitForTimeout(250); // the handle check runs first
  await submit.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/welcome"), { timeout: 30_000 }).catch(() => {});
  const where = new URL(page.url()).pathname;
  const body = await page.evaluate(() => document.body.innerText);
  const after = q(`select coalesce(avatar_url,'') || '|' || (onboarded_at is not null) from profiles where id='${uid}'`);
  ok("\"Start using Commune\" finishes setup and keeps the Google photo", after === `${GOOGLE}|true`, after);
  ok("the page moves on from the welcome screen", !where.startsWith("/welcome"), where);
  ok("no avatar error is shown", !/doesn[’']t belong to you/.test(body));

  // 2. The rule still refuses someone else's upload. Tamper with a real save on its way to the server.
  const foreign = `${SUPA}/storage/v1/object/public/avatars/${hakimId}/avatar.png`;
  let tampered = false;
  await page.route(`${DEV}/settings**`, async (route) => {
    const req = route.request();
    const data = req.postData();
    if (req.method() === "POST" && req.headers()["next-action"] && data?.includes(GOOGLE)) {
      tampered = true;
      return route.continue({ postData: data.replaceAll(GOOGLE, foreign) });
    }
    return route.continue();
  });
  const probeBefore = q(`select coalesce(avatar_url,'') || '|' || timezone from profiles where id='${uid}'`);
  const refused = await saveZone(page, "Asia/Tokyo");
  const probeNow = q(`select coalesce(avatar_url,'') || '|' || timezone from profiles where id='${uid}'`);
  ok("a save claiming Hakim's upload reached the server", tampered);
  ok("…and is refused with \"That avatar doesn't belong to you.\"", /That avatar doesn[’']t belong to you/.test(refused));
  ok("…and changes nothing", probeNow === probeBefore && probeNow.startsWith(`${GOOGLE}|`), probeNow);
  await page.unroute(`${DEV}/settings**`);
  await ctx.close();

  // 3. Hakim, whose local seed avatar is a DiceBear URL, can save Settings again.
  const hctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hp = await hctx.newPage();
  await hp.goto(`${DEV}/auth/dev-login?email=${HAKIM}`, { waitUntil: "networkidle" });
  const saved = await saveZone(hp, "Asia/Tokyo");
  const hakimTokyo = q(`select timezone || '|' || coalesce(avatar_url, '') from profiles where email='${HAKIM}'`);
  ok("Hakim saves a time zone change with the seed avatar", hakimTokyo === hakimBefore.replace(/^[^|]+/, "Asia/Tokyo"), hakimTokyo.split("|")[0]);
  ok("…and sees \"Profile saved\", not the avatar error", /Profile saved/.test(saved) && !/doesn[’']t belong to you/.test(saved));
  await saveZone(hp, hakimBefore.split("|")[0]);
  const hakimAfter = q(`select timezone || '|' || coalesce(avatar_url, '') from profiles where email='${HAKIM}'`);
  ok("Hakim's time zone is put back through the form", hakimAfter === hakimBefore, hakimAfter.split("|")[0]);
  await hctx.close();
} catch (e) {
  ok("run", false, String(e).split("\n")[0].slice(0, 200));
} finally {
  await browser.close();
  purge();
  const left = q(
    `select (select count(*) from auth.users where email='${EMAIL}') + (select count(*) from profiles where email='${EMAIL}')
          + (select count(*) from auth.identities where identity_data->>'email'='${EMAIL}') + (select count(*) from allowed_emails where email='${EMAIL}')
          + (select count(*) from channel_members cm where not exists (select 1 from profiles p where p.id=cm.user_id))`,
  );
  ok("throwaway user removed with no orphans left", left === "0", `${left} rows left`);
  ok("#general guard is back on", q("select tgenabled::text from pg_trigger where tgname='channel_members_guard'") === "O");
  if (q(`select timezone || '|' || coalesce(avatar_url, '') from profiles where email='${HAKIM}'`) !== hakimBefore) {
    const [tz, av] = hakimBefore.split("|");
    q(`update profiles set timezone='${tz}', avatar_url=${av ? `'${av}'` : "null"} where email='${HAKIM}'`);
    ok("Hakim's profile had to be restored by SQL", false);
  }
  console.log(rows.join("\n"));
}
process.exit(rows.some((r) => r.startsWith("✗")) ? 1 : 0);

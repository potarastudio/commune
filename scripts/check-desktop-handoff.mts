// Dev check: the desktop sign-in handoff, through the real /desktop/handoff
// and /api/desktop/session routes on the dev server (port 3001, local stack
// seeded). It then replays the pattern that signed the app out on
// 2026-09-11: a busy browser refreshing its session while the app sits idle.
// Under the old design, where the app shared the browser's session, the last
// check failed with refresh_token_already_used.
//   node --import tsx scripts/check-desktop-handoff.mts
import fs from "node:fs";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);
  if (!m || line.trim().startsWith("#")) continue;
  process.env[m[1]] ??= m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}
const DEV = "http://localhost:3001";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rows: string[] = [];
const ok = (label: string, pass: boolean, detail = "") => rows.push(`${pass ? "✓" : "✗"} ${label}${detail ? "   " + detail : ""}`);

/** A minimal cookie jar: enough for Supabase's auth cookies on one origin. */
class Jar {
  c = new Map<string, string>();
  take(res: Response) {
    for (const sc of res.headers.getSetCookie()) {
      const [pair, ...attrs] = sc.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a)) || value === "";
      if (expired) this.c.delete(name);
      else this.c.set(name, value);
    }
  }
  header() {
    return [...this.c].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  /** The session the Supabase SSR cookie holds (chunks joined, base64 decoded). */
  session(): { refresh_token: string; access_token: string } | null {
    const parts = [...this.c.entries()]
      .filter(([k]) => /^sb-.*-auth-token(\.\d+)?$/.test(k))
      .sort(([a], [b]) => Number(a.split(".").pop()) - Number(b.split(".").pop()));
    if (!parts.length) return null;
    let raw = decodeURIComponent(parts.map(([, v]) => v).join(""));
    if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64url").toString("utf8");
    return JSON.parse(raw);
  }
}

async function go(jar: Jar, path: string, init: RequestInit = {}) {
  const res = await fetch(`${DEV}${path}`, { ...init, redirect: "manual", headers: { ...(init.headers ?? {}), cookie: jar.header() } });
  jar.take(res);
  return res;
}
async function refresh(token: string) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: token }),
  });
  const j = (await r.json()) as { refresh_token?: string; error_code?: string };
  return { ok: r.ok, token: j.refresh_token ?? "", code: j.error_code ?? "" };
}

// 1. A browser signs in, then lands on the handoff, as it does after Google.
const browser = new Jar();
await go(browser, "/auth/dev-login?email=hi@potarastudio.com");
const browserBefore = browser.session();
const handoff = await go(browser, "/desktop/handoff");
const html = await handoff.text();
const id = /commune:\/\/auth\?handoff=([0-9a-f-]{36})/.exec(html)?.[1] ?? "";
ok("handoff page renders the deep link", handoff.status === 200 && Boolean(id), `status ${handoff.status}`);
ok("handoff leaves the browser's session exactly as it was", browser.session()?.refresh_token === browserBefore?.refresh_token);

// 2. The app window claims it.
const app = new Jar();
const claim = await go(app, "/api/desktop/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handoff: id }) });
ok("app claims the handoff", claim.status === 200, `status ${claim.status}`);
const appSession = app.session();
ok("app now holds a session", Boolean(appSession?.refresh_token));
// The token strings always differ; the session id says whether they are one session.
const sessionId = (jwt?: string) => (jwt ? (JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as { session_id?: string }).session_id : undefined);
const appSid = sessionId(appSession?.access_token);
const browserSid = sessionId(browserBefore?.access_token);
ok("…and it is a separate session from the browser's", Boolean(appSid && browserSid) && appSid !== browserSid, `${appSid?.slice(0, 8)} vs ${browserSid?.slice(0, 8)}`);
const home = await go(app, "/");
ok("app window is signed in (GET / is not sent to /login)", !(home.headers.get("location") ?? "").includes("/login"), `${home.status} → ${home.headers.get("location")}`);

// 3. Duplicate deliveries of the same link.
const dupe = await go(app, "/api/desktop/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handoff: id }) });
ok("same link again, in the signed-in app: harmless, not an error", dupe.status === 200, `status ${dupe.status} ${JSON.stringify(await dupe.json())}`);
const stranger = await go(new Jar(), "/api/desktop/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handoff: id }) });
ok("same link from a client with no session: refused", stranger.status === 401, `status ${stranger.status}`);

// 4. The pattern that signed the app out: the browser keeps refreshing, the app idles.
let bt = browserBefore!.refresh_token;
for (let i = 1; i <= 3; i++) {
  await sleep(11_000);
  const r = await refresh(bt);
  ok(`browser refresh ${i}`, r.ok, r.code);
  bt = r.token || bt;
}
const idle = await refresh(appSession!.refresh_token);
ok("idle app refreshes after the browser moved on three times", idle.ok, idle.code || "still signed in");

console.log(rows.join("\n"));
process.exit(rows.some((r) => r.startsWith("✗")) ? 1 : 0);

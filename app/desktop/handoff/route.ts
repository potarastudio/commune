import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where the desktop app's sign-in lands.
 *
 * Google refuses to run its consent screen inside an embedded browser, and a
 * magic link opens in whatever handles mail, so the desktop app signs people
 * in through the system browser: it opens /login?next=/desktop/handoff, and
 * the ordinary Google or magic-link flow ends up here with a session cookie
 * set for this browser. That browser is not the app. This route carries the
 * session across.
 *
 * It does not put the refresh token in the link. GoTrue keeps a rotated token
 * exchangeable for a while, so a token in a URL would be replayable. The
 * token is parked in desktop_handoffs under a random id that expires in two
 * minutes, the commune:// link carries only the id, and /api/desktop/session
 * claims the row — deleting it — on the way to exchanging the token. A link
 * works once. Custom-scheme links are dispatched by the OS and never touch
 * the network, so the id never leaves the machine either.
 *
 * The page it renders is what the browser tab shows afterwards: a one-line
 * "back to the app" so the tab is not a dead end if the OS does not switch.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const origin = new URL(request.url).origin;
  if (!session?.refresh_token) {
    return NextResponse.redirect(new URL("/login?next=%2Fdesktop%2Fhandoff", origin));
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("desktop_handoffs")
    .insert({ user_id: session.user.id, refresh_token: session.refresh_token })
    .select("id")
    .single();
  if (error || !data) {
    console.error("desktop handoff insert failed", { message: error?.message });
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }

  const deepLink = `commune://auth?handoff=${data.id}`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Opening Commune…</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${deepLink}">
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;
       background:#fff;color:#171717;text-align:center;padding:24px}
  p{margin:0 0 12px;color:#666}
  a{display:inline-block;height:32px;line-height:32px;padding:0 13px;border-radius:8px;background:#f05710;color:#fff;
    font-weight:600;text-decoration:none;border:1px solid #d9490a}
  @media(prefers-color-scheme:dark){body{background:#171717;color:#ededed}p{color:#9d9d9d}}
</style></head>
<body><main>
  <h1 style="font-size:15.5px;margin:0 0 5px">You're signed in</h1>
  <p>Commune should open by itself. You can close this tab.</p>
  <a href="${deepLink}">Open Commune</a>
</main></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

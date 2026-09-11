import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where the desktop app's sign-in lands.
 *
 * Google refuses to run its consent screen inside an embedded browser, and a
 * magic link opens in whatever handles mail, so the desktop app signs people
 * in through the system browser: it opens /login?next=/desktop/handoff, and
 * the ordinary Google or magic-link flow ends up here, signed in, in a
 * browser that is not the app.
 *
 * This route does not hand that browser's session across. Supabase rotates a
 * session's refresh token on every refresh and rejects one that comes back
 * two rotations late, so two clients sharing a session will eventually sign
 * one of them out (see migration 23). Instead it mints a one-time sign-in
 * token for the same user, parks it in desktop_handoffs under a random id
 * that expires in two minutes, and opens commune://auth?handoff=<id>. The
 * app claims the id through /api/desktop/session and verifies the token into
 * a session of its own. The browser's session is left exactly as it was.
 *
 * Custom-scheme links are dispatched by the OS and never touch the network,
 * and the claim deletes the row, so a link works once.
 */
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = await createSupabaseServerClient();
  // getUser, not getSession: the identity is checked with the auth server
  // rather than trusted from the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(new URL("/login?next=%2Fdesktop%2Fhandoff", origin));
  }

  // generateLink mints the token without sending any email.
  const admin = createSupabaseAdminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("desktop handoff generateLink failed", { message: linkError?.message });
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }

  const { data, error } = await admin.from("desktop_handoffs").insert({ user_id: user.id, token_hash: tokenHash }).select("id").single();
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

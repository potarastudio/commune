import { NextResponse, type NextRequest } from "next/server";
import { googleSignInUrl, safeNext } from "@/lib/auth/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Straight to Google's account chooser.
 *
 * The desktop app cannot run Google's sign-in inside its own window, so it
 * opens the browser. That used to land on Commune's login page, where the
 * same button had to be pressed a second time; this starts the flow instead.
 * A browser that is already signed in skips Google altogether and goes where
 * it was headed, which is how the desktop handoff finishes in one hop.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL(next, url.origin));

  const google = await googleSignInUrl(next);
  return NextResponse.redirect(google ?? new URL("/login?error=oauth", url.origin));
}

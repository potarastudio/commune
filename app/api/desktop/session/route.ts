import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The second half of the desktop sign-in (see app/desktop/handoff/route.ts).
 * The app posts the handoff id it received over its custom scheme. Claiming
 * the id deletes the row and yields a one-time sign-in token, which is
 * verified into a brand-new session whose cookies land in the app's own
 * window. The app then holds a session of its own, independent of the
 * browser that signed in, so neither can ever sign the other out.
 *
 * The claim is what makes a link single-use. A second post of the same id
 * finds nothing; if the window is already signed in (the OS delivered the
 * link twice, or the person pressed "Open Commune" after it had opened), that
 * is not an error and the app is told so, rather than being sent back to the
 * login page over a sign-in that worked. Nothing here creates accounts: the
 * allowlist was enforced when the person signed in in the browser.
 */
export async function POST(request: NextRequest) {
  const parsed = z.object({ handoff: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That sign-in link is not valid." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: tokenHash, error: claimError } = await admin.rpc("claim_desktop_handoff", { p_id: parsed.data.handoff });
  if (claimError) console.error("desktop handoff claim failed", { message: claimError.message });

  const supabase = await createSupabaseServerClient();
  if (!tokenHash) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return NextResponse.json({ ok: true, alreadySignedIn: true });
    return NextResponse.json({ error: "That sign-in link has expired. Sign in again." }, { status: 401 });
  }

  const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error || !data.session) {
    console.error("desktop session verify failed", { message: error?.message, status: error?.status });
    return NextResponse.json({ error: "That sign-in link has expired. Sign in again." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

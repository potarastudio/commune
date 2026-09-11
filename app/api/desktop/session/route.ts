import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The second half of the desktop sign-in (see app/desktop/handoff/route.ts).
 * The app posts the handoff id it received over its custom scheme. Claiming
 * the id deletes the row and yields the parked refresh token, which is then
 * exchanged for a session whose cookies land in the app's own window. After
 * that the desktop app is signed in exactly as a browser tab would be.
 *
 * The claim is what makes a link single-use: a second post with the same id
 * finds nothing and is refused. Nothing here creates accounts; the allowlist
 * was enforced when the session was minted.
 */
export async function POST(request: NextRequest) {
  const parsed = z.object({ handoff: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That sign-in link is not valid." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: token, error: claimError } = await admin.rpc("claim_desktop_handoff", { p_id: parsed.data.handoff });
  if (claimError) console.error("desktop handoff claim failed", { message: claimError.message });
  if (!token) return NextResponse.json({ error: "That sign-in link has expired. Sign in again." }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: token });
  if (error || !data.session) {
    console.error("desktop session exchange failed", { message: error?.message, status: error?.status });
    return NextResponse.json({ error: "That sign-in link has expired. Sign in again." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

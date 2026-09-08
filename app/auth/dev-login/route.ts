import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Development-only sign-in for the local Supabase stack, where Google OAuth is
 * not configured. Also the "mock OAuth" path for Playwright (§8).
 * Refuses to run unless the Supabase URL is the local stack.
 */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export async function GET(request: NextRequest) {
  const supabaseHost = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname;
  if (process.env.NODE_ENV === "production" || !LOCAL_HOSTS.has(supabaseHost)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = z.object({ email: z.string().email() }).safeParse({ email: url.searchParams.get("email") });
  if (!parsed.success) {
    return new NextResponse("Pass ?email=<a seeded email>", { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: parsed.data.email });
  if (error || !data.properties?.hashed_token) {
    return new NextResponse(`Could not generate link: ${error?.message ?? "unknown"}`, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) {
    return new NextResponse(`Could not verify: ${verifyError.message}`, { status: 500 });
  }

  return NextResponse.redirect(new URL("/", url.origin));
}

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google OAuth lands here with a PKCE code. Exchanging it sets the session
 * cookies. A rejected allowlist surfaces as a database error from GoTrue.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const login = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    console.error("OAuth provider error", { providerError });
    return login(/allow|database/i.test(providerError) ? "allowlist" : "oauth");
  }
  if (!code) return login("oauth");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("exchangeCodeForSession failed", { message: error.message, status: error.status });
    return login(/allow|database error/i.test(error.message) ? "allowlist" : "oauth");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

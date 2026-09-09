import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google OAuth and magic links land here. Usually with a PKCE `code`, which
 * we exchange for a session; a magic link opened in a different browser than
 * the one that asked for it arrives as `token_hash` + `type` instead, which
 * we verify directly. A rejected allowlist surfaces as a database error.
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
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createSupabaseServerClient();

  if (tokenHash && (type === "magiclink" || type === "email")) {
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (error) {
      console.error("verifyOtp failed", { message: error.message, status: error.status });
      return login(/allow|database error/i.test(error.message) ? "allowlist" : "link");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (!code) return login("oauth");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("exchangeCodeForSession failed", { message: error.message, status: error.status });
    if (/allow|database error/i.test(error.message)) return login("allowlist");
    return login(/verifier|code/i.test(error.message) ? "link" : "oauth");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

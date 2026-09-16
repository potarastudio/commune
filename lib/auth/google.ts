import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** A `next` that can only be a path on this site. */
export function safeNext(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Where Google's account chooser is for this sign-in, or null if Supabase
 * would not say.
 *
 * Google OAuth is PKCE: starting it writes a one-time secret as a cookie that
 * /auth/callback needs, so this may only be called where cookies can be
 * written — a Route Handler or a Server Action, never a page render.
 */
export async function googleSignInUrl(next: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("signInWithOAuth failed", { message: error?.message });
    return null;
  }
  return data.url;
}

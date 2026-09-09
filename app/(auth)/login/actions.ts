"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  next: z
    .string()
    .optional()
    .transform((v) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/")),
});

export async function signInWithGoogle(formData: FormData) {
  const { next } = schema.parse({ next: formData.get("next") ?? undefined });
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
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export type MagicLinkState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter the email address you were invited with.");

/**
 * Magic link sign-in (fallback for people without a Google account). The
 * allowlist is checked first so nobody is told a link is coming when it isn't;
 * GoTrue then emails a one-time link that lands on /auth/callback.
 */
export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  const email = parsed.data;
  const { next } = schema.parse({ next: formData.get("next") ?? undefined });

  const admin = createSupabaseAdminClient();
  const [{ data: allowed }, { data: existing }] = await Promise.all([
    admin.from("allowed_emails").select("email").eq("email", email).maybeSingle(),
    admin.from("profiles").select("id").eq("email", email).maybeSingle(),
  ]);
  if (!allowed && !existing) {
    return { status: "error", message: "That address isn’t on the Potara list yet. Ask Hakim to invite it, then try again." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) {
    console.error("signInWithOtp failed", { message: error.message, status: error.status });
    if (/rate limit|too many/i.test(error.message)) return { status: "error", message: "Too many links requested. Wait a few minutes and try again." };
    return { status: "error", message: "The link couldn't be sent. Try again, or use Google." };
  }
  return { status: "sent", email };
}

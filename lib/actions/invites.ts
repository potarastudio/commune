"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inviteLink, sendInviteEmail } from "@/lib/email/invite";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InviteResult =
  | { ok: true; email: string; emailed: boolean; link: string; note?: string }
  | { ok: false; error: string };

async function adminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null };
  const { data: me } = await supabase.from("profiles").select("id, display_name, role").eq("id", user.id).maybeSingle();
  return { supabase, me };
}

/** Admin: allowlist an address and email an invitation. The allowlist is what lets them in (§4). */
export async function inviteAction(input: { email: string }): Promise<InviteResult> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  const email = parsed.data.email;

  const { supabase, me } = await adminContext();
  if (!me) return { ok: false, error: "You're signed out." };
  if (me.role !== "admin") return { ok: false, error: "Only admins can invite people." };

  const { error } = await supabase
    .from("allowed_emails")
    .upsert({ email, invited_by: me.id }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    console.error("inviteAction", { message: error.message });
    return { ok: false, error: "Couldn't add that address. Try again." };
  }

  const mail = await sendInviteEmail({ to: email, inviterName: me.display_name });
  revalidatePath("/settings");
  return { ok: true, email, emailed: mail.sent, link: inviteLink(), note: mail.reason };
}

/** Admin: remove an address that hasn't signed in yet. Existing members are not affected. */
export async function revokeInviteAction(input: { email: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown address." };

  const { supabase, me } = await adminContext();
  if (!me) return { ok: false, error: "You're signed out." };
  if (me.role !== "admin") return { ok: false, error: "Only admins can manage invites." };

  const { data: existing } = await supabase.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
  if (existing) return { ok: false, error: "That person has already joined. Removing members comes with admin tools in Phase 3." };

  const { error } = await supabase.from("allowed_emails").delete().eq("email", parsed.data.email);
  if (error) {
    console.error("revokeInviteAction", { message: error.message });
    return { ok: false, error: "Couldn't remove that invite." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

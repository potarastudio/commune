"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DISPLAY_NAME_MAX, HANDLE_RE, TITLE_MAX, handleProblem } from "@/lib/utils/profile";
import { STATUS_TEXT_MAX } from "@/lib/utils/status";

export type ProfileFormResult = { ok: true } | { ok: false; error: string; field?: "display_name" | "handle" | "title" };

const schema = z.object({
  display_name: z.string().trim().min(1, "Add a display name.").max(DISPLAY_NAME_MAX, "Keep it under 80 characters."),
  handle: z.string().trim().regex(HANDLE_RE, "Use lowercase letters, numbers, dots, dashes or underscores."),
  title: z.string().trim().max(TITLE_MAX, "Keep it under 80 characters.").optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(64),
  avatar_url: z.string().url().nullable().optional(),
});

/** Saves the profile fields the user controls; the first save also completes onboarding. */
export async function saveProfileAction(input: unknown): Promise<ProfileFormResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0];
    return {
      ok: false,
      error: issue.message,
      field: field === "display_name" || field === "handle" || field === "title" ? field : undefined,
    };
  }
  const problem = handleProblem(parsed.data.handle);
  if (problem) return { ok: false, error: problem, field: "handle" };

  try {
    Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone });
  } catch {
    return { ok: false, error: "That time zone isn't recognised." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out. Sign in and try again." };

  if (parsed.data.avatar_url && !parsed.data.avatar_url.includes(`/avatars/${user.id}/`)) {
    return { ok: false, error: "That avatar doesn't belong to you." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      handle: parsed.data.handle,
      title: parsed.data.title ? parsed.data.title : null,
      timezone: parsed.data.timezone,
      ...(parsed.data.avatar_url !== undefined ? { avatar_url: parsed.data.avatar_url } : {}),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Someone already has that handle.", field: "handle" };
    console.error("saveProfileAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't save your profile. Try again." };
  }
  return { ok: true };
}

const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM.").nullable();

/** Do Not Disturb hours, both or neither. */
export async function saveDndAction(input: { dnd_start: string | null; dnd_end: string | null }): Promise<ProfileFormResult> {
  const parsed = z.object({ dnd_start: timeSchema, dnd_end: timeSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Use HH:MM." };
  if (Boolean(parsed.data.dnd_start) !== Boolean(parsed.data.dnd_end)) return { ok: false, error: "Set both a start and an end time." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { error } = await supabase.from("profiles").update({ dnd_start: parsed.data.dnd_start, dnd_end: parsed.data.dnd_end }).eq("id", user.id);
  if (error) {
    console.error("saveDndAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't save Do Not Disturb. Try again." };
  }
  return { ok: true };
}

/** Heartbeat from an open, visible tab; feeds "away" detection for the mention digest. */
export async function touchPresenceAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("touch_last_seen");
  if (error) console.error("touchPresenceAction", { code: error.code, message: error.message });
}

/** Whether missed mentions are emailed while away (Settings → Notifications). */
export async function saveEmailDigestAction(input: { enabled: boolean }): Promise<ProfileFormResult> {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something went wrong. Try again." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { error } = await supabase.from("profiles").update({ email_digest: parsed.data.enabled }).eq("id", user.id);
  if (error) {
    console.error("saveEmailDigestAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't save that. Try again." };
  }
  return { ok: true };
}

const statusSchema = z.object({
  emoji: z.string().trim().max(16).nullable(),
  text: z.string().trim().max(STATUS_TEXT_MAX, `Keep it under ${STATUS_TEXT_MAX} characters.`).nullable(),
  expiresAt: z.string().datetime().nullable(),
});

/** Set (or clear, when both parts are empty) the user's status. */
export async function setStatusAction(input: { emoji: string | null; text: string | null; expiresAt: string | null }): Promise<ProfileFormResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That status couldn't be saved." };
  const emoji = parsed.data.emoji || null;
  const text = parsed.data.text || null;
  const cleared = !emoji && !text;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { error } = await supabase
    .from("profiles")
    .update({ status_emoji: emoji, status_text: text, status_expires_at: cleared ? null : parsed.data.expiresAt })
    .eq("id", user.id);
  if (error) {
    console.error("setStatusAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't save your status. Try again." };
  }
  return { ok: true };
}

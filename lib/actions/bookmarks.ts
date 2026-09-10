"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string; field?: "title" | "url" };

const uuid = z.string().uuid();
const fields = z.object({
  title: z.string().trim().min(1, "Give it a name.").max(80, "Keep the name under 80 characters."),
  url: z
    .string()
    .trim()
    .max(2048)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.string().url("Enter a valid link.")),
  emoji: z.string().trim().max(16).nullable().optional(),
});

function firstIssue(error: z.ZodError): Result {
  const issue = error.issues[0];
  const field = issue?.path[0];
  return { ok: false, error: issue?.message ?? "Check the details.", field: field === "title" || field === "url" ? field : undefined };
}

/** Members (or admins) add a link to the channel's bookmarks bar. RLS enforces membership. */
export async function addBookmarkAction(input: { channelId: string; title: string; url: string; emoji?: string | null }): Promise<Result> {
  const parsed = z.object({ channelId: uuid }).merge(fields).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { count } = await supabase.from("channel_bookmarks").select("id", { count: "exact", head: true }).eq("channel_id", parsed.data.channelId);
  if ((count ?? 0) >= 20) return { ok: false, error: "A channel can hold 20 bookmarks. Remove one first." };

  const { error } = await supabase.from("channel_bookmarks").insert({
    channel_id: parsed.data.channelId,
    title: parsed.data.title,
    url: parsed.data.url,
    emoji: parsed.data.emoji || null,
    position: count ?? 0,
    created_by: user.id,
  });
  if (error) {
    console.error("addBookmarkAction", { code: error.code, message: error.message });
    return { ok: false, error: error.code === "42501" ? "Only members can add bookmarks." : "Couldn't add that bookmark. Try again." };
  }
  return { ok: true };
}

export async function updateBookmarkAction(input: { id: string; title: string; url: string; emoji?: string | null }): Promise<Result> {
  const parsed = z.object({ id: uuid }).merge(fields).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("channel_bookmarks")
    .update({ title: parsed.data.title, url: parsed.data.url, emoji: parsed.data.emoji || null }, { count: "exact" })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("updateBookmarkAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't save that bookmark. Try again." };
  }
  if (count === 0) return { ok: false, error: "Only members can edit bookmarks." };
  return { ok: true };
}

export async function removeBookmarkAction(input: { id: string }): Promise<Result> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("channel_bookmarks").delete({ count: "exact" }).eq("id", parsed.data.id);
  if (error) {
    console.error("removeBookmarkAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't remove that bookmark. Try again." };
  }
  if (count === 0) return { ok: false, error: "Only members can remove bookmarks." };
  return { ok: true };
}

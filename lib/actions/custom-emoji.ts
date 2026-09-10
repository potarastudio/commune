"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EMOJI_NAME_RE } from "@/lib/utils/custom-emoji";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Remove a custom emoji. RLS decides who may (creator or admin) on the row;
 * the storage object is then removed with the service role, since the bucket
 * policy only lets admins delete objects directly. Reactions keep the
 * `:name:` text and render it as plain text afterwards.
 */
export async function deleteCustomEmojiAction(input: { name: string }): Promise<Result> {
  const parsed = z.object({ name: z.string().regex(EMOJI_NAME_RE) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };

  const supabase = await createSupabaseServerClient();
  const { data: row, error: selectError } = await supabase.from("custom_emoji").select("storage_path").eq("name", parsed.data.name).maybeSingle();
  if (selectError) return { ok: false, error: "Couldn't find that emoji." };
  if (!row) return { ok: false, error: "That emoji is already gone." };

  const { error, count } = await supabase.from("custom_emoji").delete({ count: "exact" }).eq("name", parsed.data.name);
  if (error) {
    console.error("deleteCustomEmojiAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't remove that emoji. Try again." };
  }
  if (count === 0) return { ok: false, error: "Only the person who added it, or an admin, can remove it." };

  const { error: storageError } = await createSupabaseAdminClient().storage.from("emoji").remove([row.storage_path]);
  if (storageError) console.error("deleteCustomEmojiAction storage", { message: storageError.message });
  return { ok: true };
}

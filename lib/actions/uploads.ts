"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_ATTACHMENT_BYTES, safeFileName } from "@/lib/utils/files";

type Result = { ok: true; path: string; token: string } | { ok: false; error: string };

/**
 * Signed upload URL for the private `attachments` bucket (§7). The path lives
 * under the caller's folder, which both the storage policy and insert_message
 * enforce, so a signed URL never lets anyone write elsewhere.
 */
export async function createUploadUrlAction(input: { fileName: string; mimeType: string; size: number }): Promise<Result> {
  const parsed = z
    .object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string().max(255),
      size: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES, "Files need to be under 25 MB."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That file can't be uploaded." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const path = `${user.id}/${randomUUID()}/${safeFileName(parsed.data.fileName)}`;
  const { data, error } = await supabase.storage.from("attachments").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl", { message: error?.message });
    return { ok: false, error: "Couldn't start the upload. Try again." };
  }
  return { ok: true, path: data.path, token: data.token };
}

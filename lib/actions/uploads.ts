"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { presignR2Put, r2Config } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_ATTACHMENT_LABEL, MAX_LARGE_ATTACHMENT_BYTES, MAX_LARGE_ATTACHMENT_LABEL, providerFor, safeFileName } from "@/lib/utils/files";

export type UploadTarget =
  | { ok: true; provider: "supabase"; path: string; token: string }
  | { ok: true; provider: "r2"; path: string; url: string }
  | { ok: false; error: string };

/**
 * Where a file should be uploaded, and a one-time URL to do it (§7).
 *
 * Up to 50 MB goes to Supabase Storage through a signed upload URL, as it
 * always has. Anything larger goes to R2 through a presigned PUT, when R2 is
 * configured. Either way the path lives under the caller's own folder, which
 * insert_message enforces, so a URL never lets anyone write elsewhere.
 */
export async function createUploadUrlAction(input: { fileName: string; mimeType: string; size: number }): Promise<UploadTarget> {
  const parsed = z
    .object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string().max(255),
      size: z.number().int().nonnegative().max(MAX_LARGE_ATTACHMENT_BYTES, `Files need to be under ${MAX_LARGE_ATTACHMENT_LABEL}.`),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That file can't be uploaded." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const path = `${user.id}/${randomUUID()}/${safeFileName(parsed.data.fileName)}`;

  if (providerFor(parsed.data.size) === "r2") {
    const cfg = r2Config();
    if (!cfg) return { ok: false, error: `Files over ${MAX_ATTACHMENT_LABEL} aren't available yet.` };
    try {
      return { ok: true, provider: "r2", path, url: await presignR2Put(cfg, path) };
    } catch (err) {
      console.error("presignR2Put", { message: err instanceof Error ? err.message : String(err) });
      return { ok: false, error: "Couldn't start the upload. Try again." };
    }
  }

  const { data, error } = await supabase.storage.from("attachments").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl", { message: error?.message });
    return { ok: false, error: "Couldn't start the upload. Try again." };
  }
  return { ok: true, provider: "supabase", path: data.path, token: data.token };
}

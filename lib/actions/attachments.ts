"use server";

import { z } from "zod";
import { presignR2Get, r2Config } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read access to attachments that live in R2.
 *
 * Supabase Storage checks its own policies when it signs a read URL; R2 knows
 * nothing about who is asking. So these actions ask the database first, as the
 * caller: selecting the attachment rows runs the "attachments: readable
 * message" policy, which is can_read_message. Only rows that come back get a
 * URL. Someone outside a private channel gets nothing, the same as with the
 * bucket they cannot see.
 */
const paths = z.array(z.string().min(1).max(512)).max(60);

/** One-hour read URLs, keyed by storage path, for the R2 attachments the caller may read. */
export async function signR2ReadUrlsAction(input: string[]): Promise<Record<string, string>> {
  const parsed = paths.safeParse(input);
  const cfg = r2Config();
  if (!parsed.success || !cfg || parsed.data.length === 0) return {};

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("attachments").select("storage_path").eq("provider", "r2").in("storage_path", parsed.data);
  if (error || !data) {
    console.error("signR2ReadUrlsAction", { message: error?.message });
    return {};
  }
  const out: Record<string, string> = {};
  await Promise.all(data.map(async (row) => void (out[row.storage_path] = await presignR2Get(cfg, row.storage_path))));
  return out;
}

/** A download URL for one R2 attachment, saved under its original name. */
export async function r2DownloadUrlAction(input: { path: string; fileName: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = z.object({ path: z.string().min(1).max(512), fileName: z.string().min(1).max(255) }).safeParse(input);
  const cfg = r2Config();
  if (!parsed.success || !cfg) return { ok: false, error: "That file isn't available." };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("attachments").select("storage_path").eq("provider", "r2").eq("storage_path", parsed.data.path).maybeSingle();
  if (!data) return { ok: false, error: "That file isn't available." };
  return { ok: true, url: await presignR2Get(cfg, data.storage_path, { download: parsed.data.fileName }) };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { setCustomEmojiForComposer } from "@/lib/composer/emoji-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CUSTOM_EMOJI_MAX_BYTES, CUSTOM_EMOJI_TYPES, emojiNameProblem } from "@/lib/utils/custom-emoji";

import { customEmojiKeys, type CustomEmoji } from "./custom-emoji-map";

export { customEmojiKeys, useCustomEmojiMap, type CustomEmoji } from "./custom-emoji-map";

export async function fetchCustomEmoji(): Promise<CustomEmoji[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("custom_emoji").select("name, storage_path, created_by, created_at").order("name");
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    name: r.name,
    url: supabase.storage.from("emoji").getPublicUrl(r.storage_path).data.publicUrl,
    created_by: r.created_by,
    created_at: r.created_at,
  }));
}

/** The studio's custom emoji. Small and rarely changing; also fed to the composer's :shortcode: search. */
export function useCustomEmoji() {
  const query = useQuery({ queryKey: customEmojiKeys.all, queryFn: fetchCustomEmoji, staleTime: 5 * 60_000 });
  useEffect(() => {
    if (query.data) setCustomEmojiForComposer(query.data.map((e) => ({ id: e.name, name: e.name.replace(/_/g, " "), native: `:${e.name}:`, src: e.url })));
  }, [query.data]);
  return query;
}

/**
 * Add one: the row first (so a taken name fails before any bytes move), then
 * the image under `<name>.<ext>` in the public `emoji` bucket.
 */
export async function uploadCustomEmoji(input: { name: string; file: File; userId: string }): Promise<CustomEmoji> {
  const problem = emojiNameProblem(input.name);
  if (problem) throw new Error(problem);
  if (!(CUSTOM_EMOJI_TYPES as readonly string[]).includes(input.file.type)) throw new Error("Use a PNG, GIF, WebP or JPEG.");
  if (input.file.size > CUSTOM_EMOJI_MAX_BYTES) throw new Error("Keep it under 256 KB.");

  const ext = input.file.type === "image/jpeg" ? "jpg" : input.file.type.slice("image/".length);
  const path = `${input.name}.${ext}`;
  const supabase = getSupabaseBrowserClient();

  const { error: rowError } = await supabase.from("custom_emoji").insert({ name: input.name, storage_path: path, created_by: input.userId });
  if (rowError) {
    if (rowError.code === "23505") throw new Error(`:${input.name}: already exists. Pick another name.`);
    throw new Error(rowError.message);
  }

  const { error: uploadError } = await supabase.storage.from("emoji").upload(path, input.file, { contentType: input.file.type, cacheControl: "31536000", upsert: true });
  if (uploadError) {
    await supabase.from("custom_emoji").delete().eq("name", input.name);
    throw new Error(uploadError.message);
  }

  return { name: input.name, url: supabase.storage.from("emoji").getPublicUrl(path).data.publicUrl, created_by: input.userId, created_at: new Date().toISOString() };
}

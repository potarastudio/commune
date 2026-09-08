"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AVATAR_MAX_BYTES } from "@/lib/utils/profile";

/** Uploads straight from the browser into the public `avatars` bucket under the user's folder (§7). */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Images need to be under 5 MB.");

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${userId}/avatar.${ext}`;
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so a replaced avatar shows immediately.
  return `${data.publicUrl}?v=${Date.now()}`;
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { createUploadUrlAction } from "@/lib/actions/uploads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AttachmentInput } from "./messages";

export type { AttachmentInput } from "./messages";

/** Natural size of an image file, for aspect-ratio placeholders. */
export function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Browser to storage directly, using a server-minted signed upload URL (§7). */
export async function uploadAttachment(file: File): Promise<AttachmentInput> {
  const mime = file.type || "application/octet-stream";
  const url = await createUploadUrlAction({ fileName: file.name, mimeType: mime, size: file.size });
  if (!url.ok) throw new Error(url.error);

  const [{ error }, size] = await Promise.all([
    getSupabaseBrowserClient()
      .storage.from("attachments")
      .uploadToSignedUrl(url.path, url.token, file, { contentType: mime, upsert: false }),
    readImageSize(file),
  ]);
  if (error) throw new Error(error.message);

  return {
    storage_path: url.path,
    file_name: file.name,
    mime_type: mime,
    size_bytes: file.size,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

const SIGNED_TTL_SECONDS = 60 * 60;

/** Signed read URLs for attachments; refreshed before they expire. */
export function useSignedUrls(paths: string[]) {
  const key = [...paths].sort();
  return useQuery({
    queryKey: ["signed-urls", key],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient().storage.from("attachments").createSignedUrls(key, SIGNED_TTL_SECONDS);
      if (error) throw new Error(error.message);
      const map: Record<string, string> = {};
      for (const row of data) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      return map;
    },
    enabled: key.length > 0,
    staleTime: (SIGNED_TTL_SECONDS - 300) * 1000,
    gcTime: SIGNED_TTL_SECONDS * 1000,
  });
}

/** One-off download URL that sets Content-Disposition: attachment. */
export async function getDownloadUrl(path: string, fileName: string): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient()
    .storage.from("attachments")
    .createSignedUrl(path, 120, { download: fileName });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

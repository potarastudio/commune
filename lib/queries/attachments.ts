"use client";

import { useQuery } from "@tanstack/react-query";
import { r2DownloadUrlAction, signR2ReadUrlsAction } from "@/lib/actions/attachments";
import { createUploadUrlAction } from "@/lib/actions/uploads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AttachmentProvider } from "@/lib/utils/files";
import type { AttachmentInput } from "./messages";

export type { AttachmentInput } from "./messages";

/** What the read helpers need to know about an attachment. */
export type AttachmentRef = { storage_path: string; provider: AttachmentProvider | string };

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

/**
 * PUT a file to a presigned URL with progress. fetch() cannot report upload
 * progress, and a 500 MB file with no bar reads as a hang, so this is the one
 * place XMLHttpRequest still earns its keep.
 */
function putWithProgress(url: string, file: File, mimeType: string, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload was refused (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload didn't reach the server. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

/** Browser to storage directly, using a server-minted URL (§7). Large files report progress. */
export async function uploadAttachment(file: File, onProgress?: (fraction: number) => void): Promise<AttachmentInput> {
  const mime = file.type || "application/octet-stream";
  const target = await createUploadUrlAction({ fileName: file.name, mimeType: mime, size: file.size });
  if (!target.ok) throw new Error(target.error);

  const sizePromise = readImageSize(file);
  if (target.provider === "r2") {
    await putWithProgress(target.url, file, mime, onProgress);
  } else {
    const { error } = await getSupabaseBrowserClient()
      .storage.from("attachments")
      .uploadToSignedUrl(target.path, target.token, file, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);
  }
  const size = await sizePromise;

  return {
    storage_path: target.path,
    provider: target.provider,
    file_name: file.name,
    mime_type: mime,
    size_bytes: file.size,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

const SIGNED_TTL_SECONDS = 60 * 60;

/**
 * Read URLs for attachments, keyed by storage path and refreshed before they
 * expire. Supabase signs its own; R2 paths go through the server, which checks
 * the rows' RLS before signing (see lib/actions/attachments.ts).
 */
export function useSignedUrls(refs: AttachmentRef[]) {
  const key = [...refs].sort((a, b) => a.storage_path.localeCompare(b.storage_path));
  return useQuery({
    queryKey: ["signed-urls", key.map((r) => `${r.provider}:${r.storage_path}`)],
    queryFn: async () => {
      const supabasePaths = key.filter((r) => r.provider !== "r2").map((r) => r.storage_path);
      const r2Paths = key.filter((r) => r.provider === "r2").map((r) => r.storage_path);
      const map: Record<string, string> = {};

      const [signed, r2] = await Promise.all([
        supabasePaths.length
          ? getSupabaseBrowserClient().storage.from("attachments").createSignedUrls(supabasePaths, SIGNED_TTL_SECONDS)
          : Promise.resolve({ data: [], error: null }),
        r2Paths.length ? signR2ReadUrlsAction(r2Paths) : Promise.resolve({}),
      ]);
      if (signed.error) throw new Error(signed.error.message);
      for (const row of signed.data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      Object.assign(map, r2);
      return map;
    },
    enabled: key.length > 0,
    staleTime: (SIGNED_TTL_SECONDS - 300) * 1000,
    gcTime: SIGNED_TTL_SECONDS * 1000,
  });
}

/** One-off download URL that sets Content-Disposition: attachment. */
export async function getDownloadUrl(att: AttachmentRef & { file_name?: string | null }): Promise<string> {
  const fileName = att.file_name ?? "file";
  if (att.provider === "r2") {
    const r = await r2DownloadUrlAction({ path: att.storage_path, fileName });
    if (!r.ok) throw new Error(r.error);
    return r.url;
  }
  const { data, error } = await getSupabaseBrowserClient().storage.from("attachments").createSignedUrl(att.storage_path, 120, { download: fileName });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

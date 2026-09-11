/**
 * Attachment rules shared by client and server.
 *
 * The per-file limit is the one number every copy of it derives from: the
 * client check, the server actions, the drop-zone copy, and (by hand, in the
 * migration) the bucket and the column constraint. 50 MB is the ceiling the
 * Supabase Free plan allows for any upload; raising it further means a paid
 * plan first, then this constant and a migration.
 */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
/** "50 MB", for copy that states the limit. */
export const MAX_ATTACHMENT_LABEL = formatBytes(MAX_ATTACHMENT_BYTES);
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** Keep the original name recognisable but safe for a storage path. */
export function safeFileName(name: string): string {
  const trimmed = name
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "");
  const cleaned = trimmed
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return cleaned || "file";
}

export function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && /^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/.test(mime);
}

export type FileKind = "image" | "pdf" | "archive" | "video" | "audio" | "text" | "file";

export function fileKind(mime: string | null | undefined, name: string | null | undefined): FileKind {
  const m = mime ?? "";
  if (isImageMime(m)) return "image";
  if (m === "application/pdf") return "pdf";
  if (/zip|tar|gzip|rar|7z/.test(m) || /\.(zip|tar|gz|rar|7z)$/i.test(name ?? "")) return "archive";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("text/") || /json|xml|csv/.test(m)) return "text";
  return "file";
}

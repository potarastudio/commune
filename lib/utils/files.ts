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

/**
 * Files above MAX_ATTACHMENT_BYTES go to Cloudflare R2 instead, when it is
 * configured. 1 GB is Slack's limit and comfortably below R2's own; the
 * column constraint in migration 22 enforces the same number.
 */
export const MAX_LARGE_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
export const MAX_LARGE_ATTACHMENT_LABEL = "1 GB";

export type AttachmentProvider = "supabase" | "r2";

/** Which store a file of this size belongs in. */
export function providerFor(sizeBytes: number): AttachmentProvider {
  return sizeBytes > MAX_ATTACHMENT_BYTES ? "r2" : "supabase";
}

/** True when the build was made with R2 configured; inlined by next.config.ts. */
export function largeUploadsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LARGE_UPLOADS === "1";
}

/** The limit this build accepts, and its label for copy. */
export function attachmentLimitBytes(): number {
  return largeUploadsEnabled() ? MAX_LARGE_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES;
}
export function attachmentLimitLabel(): string {
  return largeUploadsEnabled() ? MAX_LARGE_ATTACHMENT_LABEL : MAX_ATTACHMENT_LABEL;
}
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

"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import type { PendingUpload } from "@/lib/queries/use-uploads";
import { formatBytes } from "@/lib/utils/files";

/**
 * Files queued on the composer, shown above the toolbar until the message is
 * sent. Three tiles per the design: uploading (progress), done (size) and
 * failed (danger surface + retry).
 */
export function PendingAttachments({
  uploads,
  onRemove,
  onRetry,
}: {
  uploads: PendingUpload[];
  onRemove: (id: string) => void;
  /** Re-queues the same file; omitted where the composer cannot retry. */
  onRetry?: (upload: PendingUpload) => void;
}) {
  if (uploads.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 border-b border-border-subtle px-3.5 pt-3" aria-label="Files to send">
      {uploads.map((u) => {
        const failed = u.status === "error";
        return (
          <li
            key={u.id}
            className={`flex max-w-full items-center gap-[11px] rounded-lg border px-2.5 py-[9px] ${
              failed ? "w-[300px] border-danger bg-danger-surface" : "w-[280px] border-border bg-bg-chip"
            }`}
          >
            {u.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.previewUrl} alt="" className="size-[34px] shrink-0 rounded-md border border-border-subtle object-cover" />
            ) : (
              <span
                className={`grid size-[34px] shrink-0 place-items-center rounded-md border border-border-subtle bg-bg-card ${
                  failed ? "text-danger" : "text-fg-600"
                }`}
              >
                <FileText className="size-4" aria-hidden="true" />
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">{u.file.name}</span>

              {u.status === "uploading" && (
                <span className="my-[7px] mb-[5px] block h-[5px] overflow-hidden rounded-full bg-bg-avatar">
                  {/* Large uploads report bytes and get a real fill. The small path
                      cannot, so its fill spans the track and pulses — a fixed
                      fraction would read as stalled. */}
                  {u.progress === undefined ? (
                    <span className="block h-[5px] w-full animate-pulse rounded-full bg-primary" />
                  ) : (
                    <span className="block h-[5px] rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                  )}
                </span>
              )}

              <span
                className={`block tabular-nums ${
                  failed ? "mt-0.5 text-[11.5px] font-semibold text-danger" : "text-[11.5px] text-muted-foreground"
                }`}
              >
                {u.status === "uploading"
                  ? u.progress === undefined
                    ? `Uploading · ${formatBytes(u.file.size)}`
                    : `Uploading · ${Math.round(u.progress * 100)}% of ${formatBytes(u.file.size)}`
                  : failed
                    ? (u.error ?? "Upload failed.")
                    : formatBytes(u.file.size)}
              </span>
            </span>

            {failed ? (
              <span className="flex shrink-0 items-center gap-1">
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(u)}
                    className="flex h-[26px] items-center rounded-[7px] border border-border-strong bg-bg-card px-[9px] text-[12px] font-semibold text-ink transition-colors hover:bg-bg-card-hover"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(u.id)}
                  aria-label={`Remove ${u.file.name}`}
                  className="grid size-[26px] place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-subtle hover:text-danger"
                >
                  <Trash2 className="size-[14px]" aria-hidden="true" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                aria-label={u.status === "uploading" ? `Cancel upload of ${u.file.name}` : `Remove ${u.file.name}`}
                className="grid size-[26px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-subtle hover:text-ink"
              >
                <Plus className="size-[14px] rotate-45" aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

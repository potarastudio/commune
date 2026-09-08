"use client";

import { AlertCircle, File, Loader2, X } from "lucide-react";
import type { PendingUpload } from "@/lib/queries/use-uploads";
import { formatBytes } from "@/lib/utils/files";

/** Files queued on the composer, shown above the toolbar until the message is sent. */
export function PendingAttachments({ uploads, onRemove }: { uploads: PendingUpload[]; onRemove: (id: string) => void }) {
  if (uploads.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Files to send">
      {uploads.map((u) => (
        <li
          key={u.id}
          className={`group/chip relative flex items-center gap-2 rounded-lg border bg-muted pr-2 text-[12px] ${
            u.status === "error" ? "border-destructive/50" : "border-border"
          }`}
        >
          {u.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.previewUrl} alt="" className="size-12 rounded-l-lg object-cover" />
          ) : (
            <span className="grid size-12 place-items-center rounded-l-lg bg-accent text-accent-foreground">
              <File className="size-4" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 max-w-40 leading-tight">
            <span className="block truncate font-medium">{u.file.name}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              {u.status === "uploading" && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              {u.status === "error" && <AlertCircle className="size-3 text-destructive" aria-hidden="true" />}
              {u.status === "uploading" ? "Uploading…" : u.status === "error" ? (u.error ?? "Failed") : formatBytes(u.file.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onRemove(u.id)}
            aria-label={`Remove ${u.file.name}`}
            className="ml-1 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

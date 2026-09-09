"use client";

import { Download, File, FileArchive, FileAudio, FileText, FileVideo, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDownloadUrl, useSignedUrls } from "@/lib/queries/attachments";
import type { AttachmentRow } from "@/lib/queries/messages";
import { fileKind, formatBytes, type FileKind } from "@/lib/utils/files";

/** Optimistic messages carry a local object URL until the server row arrives. */
export type AttachmentView = AttachmentRow & { preview_url?: string };

const ICONS: Record<Exclude<FileKind, "image">, typeof File> = {
  pdf: FileText,
  text: FileText,
  archive: FileArchive,
  video: FileVideo,
  audio: FileAudio,
  file: File,
};

export function DownloadButton({ attachment, className }: { attachment: AttachmentView; className?: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const url = await getDownloadUrl(attachment.storage_path, attachment.file_name ?? "file");
      window.location.assign(url);
    } catch (err) {
      toast.error("Couldn't download that file", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void download();
          }}
          aria-label={`Download ${attachment.file_name ?? "file"}`}
          className={className}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Download</TooltipContent>
    </Tooltip>
  );
}

/** Images inline, everything else as a card, both with a download action (§5). */
export function AttachmentList({ attachments }: { attachments: AttachmentView[] }) {
  const needsUrl = attachments.filter((a) => !a.preview_url).map((a) => a.storage_path);
  const { data: urls } = useSignedUrls(needsUrl);
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => fileKind(a.mime_type, a.file_name) === "image");
  const files = attachments.filter((a) => fileKind(a.mime_type, a.file_name) !== "image");

  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((a) => {
            const src = a.preview_url ?? urls?.[a.storage_path];
            const ratio = a.width && a.height ? a.width / a.height : 4 / 3;
            const width = Math.min(360, Math.round(240 * ratio));
            return (
              <figure
                key={a.id}
                className="group/img relative overflow-hidden rounded-lg border border-border bg-muted"
                style={{ width, aspectRatio: `${ratio}` }}
              >
                {src ? (
                  <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open ${a.file_name ?? "image"} full size`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={a.file_name ?? ""} className="size-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <Skeleton className="size-full rounded-none" />
                )}
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white opacity-0 transition-opacity group-hover/img:opacity-100 group-focus-within/img:opacity-100">
                  <span className="min-w-0 truncate">{a.file_name}</span>
                  <span className="pointer-events-auto ml-auto">
                    <DownloadButton attachment={a} className="grid size-6 place-items-center rounded bg-black/40 hover:bg-black/60" />
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
      {files.map((a) => {
        const Icon = ICONS[fileKind(a.mime_type, a.file_name) as Exclude<FileKind, "image">] ?? File;
        return (
          <div
            key={a.id}
            className="flex w-fit max-w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 pr-2"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-medium">{a.file_name}</span>
              <span className="block text-[12px] text-muted-foreground">
                {formatBytes(a.size_bytes)}
                {a.mime_type ? ` · ${a.mime_type.split("/")[1]?.toUpperCase().slice(0, 8)}` : ""}
              </span>
            </span>
            <DownloadButton
              attachment={a}
              className="ml-2 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { File, FileArchive, FileAudio, FileText, FileVideo, Paperclip } from "lucide-react";
import Link from "next/link";
import { DownloadButton } from "@/components/message/attachment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedUrls } from "@/lib/queries/attachments";
import { useContainerFiles, type ContainerFile } from "@/lib/queries/files";
import type { Container } from "@/lib/queries/messages";
import { fileKind, formatBytes, type FileKind } from "@/lib/utils/files";
import { formatShortDate } from "@/lib/utils/time";
import { useViewerTimezone } from "@/lib/viewer-timezone";

const ICONS: Record<Exclude<FileKind, "image">, typeof File> = { pdf: FileText, text: FileText, archive: FileArchive, video: FileVideo, audio: FileAudio, file: File };

/** Every file shared here, newest first, with a jump to its message. Lives in the details panel's Files tab. */
export function FilesList({ container, containerLabel }: { container: Container; containerLabel: string }) {
  const tz = useViewerTimezone();
  const { data: files, isPending } = useContainerFiles(container);
  const images = (files ?? [])
    .filter((f) => fileKind(f.mime_type, f.file_name) === "image")
    .map((f) => ({ storage_path: f.storage_path, provider: f.provider }));
  const { data: urls } = useSignedUrls(images);
  const base = container.kind === "channel" ? `/channel/${container.id}` : `/dm/${container.id}`;

  if (isPending) {
    return (
      <div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-[11px] border-b border-border-subtle px-4 py-[11px]">
            <Skeleton className="size-[34px] shrink-0 rounded-[9px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
          <Paperclip className="size-[17px]" aria-hidden="true" />
        </span>
        <h3 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No files yet</h3>
        <p className="mt-[5px] text-pretty text-[13px] leading-[1.55] text-fg-600">Anything dropped into {containerLabel} shows up here, newest first.</p>
      </div>
    );
  }

  const href = (f: ContainerFile) => (f.message.parent_id ? `${base}?thread=${f.message.parent_id}` : `${base}?message=${f.message.id}`);

  return (
    <ul>
      {files.map((f) => {
        const kind = fileKind(f.mime_type, f.file_name);
        const Icon = kind === "image" ? null : ICONS[kind];
        const thumb = kind === "image" ? urls?.[f.storage_path] : undefined;
        return (
          <li key={f.id} className="group/file flex items-center gap-[11px] border-b border-border-subtle px-4 py-[11px] hover:bg-bg-hover">
            <Link href={href(f)} scroll={false} className="flex min-w-0 flex-1 items-center gap-[11px]" aria-label={`${f.file_name ?? "File"}, jump to message`}>
              <span className="grid size-[34px] shrink-0 place-items-center overflow-hidden rounded-[9px] border border-border-subtle bg-bg-chip text-fg-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : Icon ? <Icon className="size-[15px]" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{f.file_name ?? "File"}</span>
                <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                  {f.message.author?.display_name ?? "Someone"} · {formatShortDate(f.message.created_at, tz)} · {formatBytes(f.size_bytes)}
                </span>
              </span>
            </Link>
            <DownloadButton
              attachment={f}
              /* Drawn persistently, as the design has it — hover-only would put
                 it out of reach on touch. */
              className="grid size-[30px] shrink-0 place-items-center rounded-[7px] text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
            />
          </li>
        );
      })}
    </ul>
  );
}

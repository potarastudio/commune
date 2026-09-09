"use client";

import { format, isThisYear } from "date-fns";
import { File, FileArchive, FileAudio, FileText, FileVideo, Paperclip } from "lucide-react";
import Link from "next/link";
import { DownloadButton } from "@/components/message/attachment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedUrls } from "@/lib/queries/attachments";
import { useContainerFiles, type ContainerFile } from "@/lib/queries/files";
import type { Container } from "@/lib/queries/messages";
import { fileKind, formatBytes, type FileKind } from "@/lib/utils/files";

const ICONS: Record<Exclude<FileKind, "image">, typeof File> = { pdf: FileText, text: FileText, archive: FileArchive, video: FileVideo, audio: FileAudio, file: File };

function when(iso: string) {
  const d = new Date(iso);
  return isThisYear(d) ? format(d, "d MMM") : format(d, "d MMM yyyy");
}

/** Every file shared here, newest first, with a jump to its message. Lives in the details panel's Files tab. */
export function FilesList({ container, containerLabel }: { container: Container; containerLabel: string }) {
  const { data: files, isPending } = useContainerFiles(container);
  const images = (files ?? []).filter((f) => fileKind(f.mime_type, f.file_name) === "image").map((f) => f.storage_path);
  const { data: urls } = useSignedUrls(images);
  const base = container.kind === "channel" ? `/channel/${container.id}` : `/dm/${container.id}`;

  if (isPending) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Paperclip className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold tracking-tight">No files yet</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Anything dropped into {containerLabel} shows up here, newest first.</p>
      </div>
    );
  }

  const href = (f: ContainerFile) => (f.message.parent_id ? `${base}?thread=${f.message.parent_id}` : `${base}?message=${f.message.id}`);

  return (
    <ul className="px-2 py-2">
      {files.map((f) => {
        const kind = fileKind(f.mime_type, f.file_name);
        const Icon = kind === "image" ? null : ICONS[kind];
        const thumb = kind === "image" ? urls?.[f.storage_path] : undefined;
        return (
          <li key={f.id} className="group/file flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-message-hover">
            <Link href={href(f)} scroll={false} className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${f.file_name ?? "File"}, jump to message`}>
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{f.file_name ?? "File"}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {formatBytes(f.size_bytes)} · {f.message.author?.display_name ?? "Someone"} · {when(f.message.created_at)}
                </span>
              </span>
            </Link>
            <DownloadButton
              attachment={f}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/file:opacity-100"
            />
          </li>
        );
      })}
    </ul>
  );
}

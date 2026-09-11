"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadAttachment, type AttachmentInput } from "./attachments";
import { MAX_ATTACHMENTS_PER_MESSAGE, attachmentLimitBytes, attachmentLimitLabel, formatBytes } from "@/lib/utils/files";

export type PendingUpload = {
  id: string;
  file: File;
  previewUrl: string | null;
  status: "uploading" | "done" | "error";
  /** 0–1 while a large upload reports progress; absent for the small path, which cannot. */
  progress?: number;
  error?: string;
  result?: AttachmentInput;
};

/** Files queued on a composer: uploaded immediately, attached when the message is sent. */
export function useAttachmentUploads() {
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  const update = useCallback((id: string, patch: Partial<PendingUpload>) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const room = MAX_ATTACHMENTS_PER_MESSAGE - uploadsRef.current.length;
      if (incoming.length > room) toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
      const limit = attachmentLimitBytes();
      for (const file of incoming.slice(0, Math.max(room, 0))) {
        if (file.size > limit) {
          toast.error(`${file.name} is ${formatBytes(file.size)}. Files need to be under ${attachmentLimitLabel()}.`);
          continue;
        }
        const id = crypto.randomUUID();
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        setUploads((list) => [...list, { id, file, previewUrl, status: "uploading" }]);
        uploadAttachment(file, (progress) => update(id, { progress }))
          .then((result) => update(id, { status: "done", progress: undefined, result }))
          .catch((err: unknown) => {
            update(id, { status: "error", progress: undefined, error: err instanceof Error ? err.message : "Upload failed." });
            toast.error(`Couldn't upload ${file.name}`, { description: err instanceof Error ? err.message : undefined });
          });
      }
    },
    [update],
  );

  const remove = useCallback((id: string) => {
    setUploads((list) => {
      const gone = list.find((u) => u.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return list.filter((u) => u.id !== id);
    });
  }, []);

  /** Empties the queue. Previews are revoked by the sender once the server row is in the cache. */
  const clear = useCallback(() => setUploads([]), []);

  useEffect(() => () => uploadsRef.current.forEach((u) => u.previewUrl && URL.revokeObjectURL(u.previewUrl)), []);

  const uploading = uploads.some((u) => u.status === "uploading");
  const ready = uploads.filter((u) => u.status === "done" && u.result).map((u) => u.result as AttachmentInput);

  return { uploads, addFiles, remove, clear, uploading, ready };
}

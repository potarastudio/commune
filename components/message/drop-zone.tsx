"use client";

import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

/** Whole-pane drag-and-drop target with an overlay while a file is over it. */
export function DropZone({ label, onFiles, children }: { label: string; onFiles: (files: FileList) => void; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    },
    [],
  );
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setOver(false);
    }
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      {children}
      {over && (
        <div
          className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/85 backdrop-blur-[2px]"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold">Drop to upload to {label}</p>
            <p className="text-[13px] text-muted-foreground">Up to 10 files, 25 MB each.</p>
          </div>
        </div>
      )}
    </div>
  );
}

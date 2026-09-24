"use client";

import { ChevronRight, Download, File, FileArchive, FileAudio, FileText, FileVideo, ImageOff, MessageSquareText, Share, SmilePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { AttachmentView } from "@/components/message/attachment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getDownloadUrl, useSignedUrls } from "@/lib/queries/attachments";
import { isNativeApp, native } from "@/lib/native";
import { cn } from "@/lib/utils";
import { fileKind, formatBytes, type FileKind } from "@/lib/utils/files";
import { humanError } from "@/lib/utils/human-error";
import { EmojiSheet } from "./emoji-sheet";

const FILE_ICONS: Record<Exclude<FileKind, "image">, typeof File> = {
  pdf: FileText,
  text: FileText,
  archive: FileArchive,
  video: FileVideo,
  audio: FileAudio,
  file: File,
};

export type MediaActions = {
  author: string;
  time: string;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
};

/** Opens a file where the phone can show it: the browser sheet in the app (Back still means back), a new tab elsewhere. */
async function openFile(a: AttachmentView) {
  try {
    const url = await getDownloadUrl(a);
    if (isNativeApp()) native.openBrowser(url);
    else window.open(url, "_blank", "noopener");
  } catch (err) {
    toast.error("Couldn't open that file", { description: humanError(err, "Check your connection and try again.") });
  }
}

/**
 * Hands the image to the phone's share sheet — which is also where "Save
 * Image" lives, since a page cannot write to the photo library itself. Falls
 * back to a plain download where files cannot be shared.
 */
async function shareImage(a: AttachmentView, src: string) {
  try {
    const blob = await (await fetch(src)).blob();
    const file = new window.File([blob], a.file_name ?? "image", { type: a.mime_type ?? blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    window.location.assign(await getDownloadUrl(a));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return; // closed the sheet
    toast.error("Couldn't share that image", { description: humanError(err, "Try again in a moment.") });
  }
}

/** Pinch and double-tap zoom for one image, with panning while zoomed. */
function useZoom() {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);

  const reset = () => setView({ scale: 1, x: 0, y: 0 });
  const distance = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        pinch.current = { dist: distance(e.touches), scale: view.scale };
        pan.current = null;
      } else if (e.touches.length === 1 && view.scale > 1) {
        pan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: view.x, oy: view.y };
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (pinch.current && e.touches.length === 2) {
        const scale = Math.min(4, Math.max(1, (pinch.current.scale * distance(e.touches)) / pinch.current.dist));
        setView((v) => ({ ...v, scale }));
      } else if (pan.current && e.touches.length === 1) {
        const p = pan.current;
        setView((v) => ({ ...v, x: p.ox + e.touches[0].clientX - p.x, y: p.oy + e.touches[0].clientY - p.y }));
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null;
      if (e.touches.length === 0) pan.current = null;
      if (view.scale < 1.05) reset();
    },
  };

  /** A second tap within 280ms zooms to 2× there, or back out. Returns whether it was one. */
  const doubleTap = (): boolean => {
    const now = Date.now();
    const hit = now - lastTap.current < 280;
    lastTap.current = hit ? 0 : now;
    if (hit) setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2, x: 0, y: 0 }));
    return hit;
  };

  return { view, handlers, reset, doubleTap, zoomed: view.scale > 1 };
}

function Slide({
  src,
  alt,
  active,
  onToggleChrome,
  onZoomChange,
}: {
  src: string | undefined;
  alt: string;
  active: boolean;
  onToggleChrome: () => void;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const zoom = useZoom();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => onZoomChange(zoom.zoomed), [zoom.zoomed, onZoomChange]);
  useEffect(() => {
    if (!active) zoom.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-[28px] text-center">
        <span className="grid size-[56px] place-items-center rounded-[16px] border border-white/14 bg-white/6 text-white/70">
          <ImageOff className="size-[25px]" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="mt-[16px] text-[18px] font-semibold tracking-[-0.02em] text-white">Couldn&rsquo;t load this image</h2>
        <p className="mt-[8px] max-w-[280px] text-[13.5px] leading-[1.6] text-white/60">
          {typeof navigator !== "undefined" && !navigator.onLine ? "You’re offline. It will load when you reconnect." : "It may have been removed, or the link expired."}
        </p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          className="mt-[18px] flex h-[44px] w-full max-w-[230px] items-center justify-center rounded-[12px] border border-accent-border bg-primary text-[14px] font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      {...zoom.handlers}
      onClick={() => {
        if (zoom.doubleTap()) {
          clearTimeout(tapTimer.current);
          return;
        }
        // A single tap shows or hides everything but the photo, once it is clear it was not a double tap.
        tapTimer.current = setTimeout(onToggleChrome, 290);
      }}
      className={cn("grid h-full w-full place-items-center overflow-hidden px-[10px] py-[14px]", zoom.zoomed && "touch-none")}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, sized by the viewer
        <img
          key={attempt}
          src={src}
          alt={alt}
          draggable={false}
          onError={() => setFailed(true)}
          className="max-h-full max-w-full rounded-[10px] object-contain select-none"
          style={{ transform: `translate(${zoom.view.x}px, ${zoom.view.y}px) scale(${zoom.view.scale})`, transition: zoom.view.scale === 1 ? "transform 200ms ease" : undefined }}
        />
      ) : (
        <Skeleton className="aspect-[4/5] w-full rounded-[10px] bg-white/10" />
      )}
    </div>
  );
}

/**
 * The phone's image viewer (design: Mobile Media → Image viewer, Gallery,
 * Chrome hidden, Failed). A black ground and the actions you actually want
 * on a photo as a row; one tap and everything but the photo goes. With
 * several images, swipe between them — dots say where you are and the
 * filmstrip jumps.
 */
export function ImageViewer({
  images,
  urls,
  start,
  onClose,
  actions,
}: {
  images: AttachmentView[];
  urls: Record<string, string | undefined>;
  start: number;
  onClose: () => void;
  actions: MediaActions;
}) {
  const [index, setIndex] = useState(start);
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const current = images[index];
  const src = (a: AttachmentView) => a.preview_url ?? urls[a.storage_path];

  // Open on the tapped image.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape and Android's back close the viewer before anything else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const offBack = native.onBackButton(onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      offBack();
    };
  }, [onClose]);

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const bar = "flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[11px] text-white/90 active:bg-white/10 [&>svg]:size-[20px]";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={current?.file_name ?? "Image"} className="fixed inset-0 z-[60] flex flex-col bg-rail">
      <div className={cn("pt-safe flex shrink-0 items-center gap-[8px] px-[6px] pt-[8px] transition-opacity", !chrome && "pointer-events-none opacity-0")}>
        <button type="button" aria-label="Close" onClick={onClose} className={bar}>
          <X className="!size-[21px]" aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 text-center">
          <span className="block truncate text-[13.5px] font-semibold text-white">{current?.file_name ?? "Image"}</span>
          <span className="mt-px block truncate text-[11.5px] text-white/60">
            {images.length > 1 ? `${index + 1} of ${images.length} · ` : ""}
            {actions.author} · {actions.time}
          </span>
        </span>
        <span className="size-[44px] shrink-0" aria-hidden="true" />
      </div>

      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index && i >= 0 && i < images.length) {
            setIndex(i);
            setConfirmDelete(false);
          }
        }}
        className={cn(
          "flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          zoomed ? "overflow-hidden" : "overflow-x-auto",
        )}
      >
        {images.map((a, i) => (
          <div key={a.id} className="h-full w-full shrink-0 snap-center">
            <Slide src={src(a)} alt={a.file_name ?? ""} active={i === index} onToggleChrome={() => setChrome((c) => !c)} onZoomChange={setZoomed} />
          </div>
        ))}
      </div>

      <div className={cn("pb-safe shrink-0 transition-opacity", !chrome && "pointer-events-none opacity-0")}>
        {images.length > 1 && (
          <>
            <div className="flex items-center justify-center gap-[6px] pb-[10px]" aria-hidden="true">
              {images.map((a, i) => (
                <span key={a.id} className={cn("block h-[6px] rounded-full transition-all", i === index ? "w-[18px] bg-primary" : "w-[6px] bg-white/30")} />
              ))}
            </div>
            <div className="flex gap-[7px] overflow-x-auto px-[12px] pb-[10px] [scrollbar-width:none]">
              {images.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`Image ${i + 1} of ${images.length}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => goTo(i)}
                  className={cn("block size-[60px] shrink-0 overflow-hidden rounded-[11px] border-2", i === index ? "border-primary" : "border-transparent")}
                >
                  {src(a) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src(a)} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="block size-full bg-white/10" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-around px-[10px] pt-[4px] pb-[20px]">
          <button type="button" aria-label="Save" onClick={() => current && src(current) && void shareImage(current, src(current)!)} className={bar}>
            <Download aria-hidden="true" />
          </button>
          <button type="button" aria-label="Share" onClick={() => current && src(current) && void shareImage(current, src(current)!)} className={bar}>
            <Share aria-hidden="true" />
          </button>
          <button type="button" aria-label="React" onClick={() => setEmojiOpen(true)} className={bar}>
            <SmilePlus aria-hidden="true" />
          </button>
          {actions.onReply && (
            <button
              type="button"
              aria-label="Reply in thread"
              onClick={() => {
                onClose();
                actions.onReply?.();
              }}
              className={bar}
            >
              <MessageSquareText aria-hidden="true" />
            </button>
          )}
          {actions.onDelete && (
            <button
              type="button"
              aria-label={confirmDelete ? "Tap again to delete the message" : "Delete message"}
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  toast("Tap delete again to remove the message", { description: "The whole message goes, not just this image." });
                  return;
                }
                onClose();
                actions.onDelete?.();
              }}
              className={cn(bar, confirmDelete && "bg-danger text-white active:bg-danger")}
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <EmojiSheet open={emojiOpen} onOpenChange={setEmojiOpen} onPick={actions.onReact} />
    </div>,
    document.body,
  );
}

/**
 * Attachments in a message on the phone (design: Mobile Media → In the
 * message). One image goes full width; several become a two-up grid with a
 * "+3" cover; files stay a row, since a PDF thumbnail tells you nothing, and
 * open in the app's browser sheet.
 */
export function MobileAttachments({ attachments, actions }: { attachments: AttachmentView[]; actions: MediaActions }) {
  const needsUrl = attachments.filter((a) => !a.preview_url).map((a) => ({ storage_path: a.storage_path, provider: a.provider }));
  const { data: urls } = useSignedUrls(needsUrl);
  const [viewing, setViewing] = useState<number | null>(null);
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => fileKind(a.mime_type, a.file_name) === "image");
  const files = attachments.filter((a) => fileKind(a.mime_type, a.file_name) !== "image");
  const src = (a: AttachmentView) => a.preview_url ?? urls?.[a.storage_path];

  const tile = (a: AttachmentView, i: number, className: string, overlay?: React.ReactNode, style?: React.CSSProperties) => (
    <button
      key={a.id}
      type="button"
      onClick={() => setViewing(i)}
      aria-label={images.length > 1 ? `Open image ${i + 1} of ${images.length}` : "Open image"}
      className={cn("relative block overflow-hidden bg-bg-avatar", className)}
      style={style}
    >
      {src(a) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src(a)} alt={a.file_name ?? ""} loading="lazy" className="size-full object-cover" />
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
      {overlay}
    </button>
  );

  return (
    <div className="mt-[8px] space-y-[8px]">
      {images.length === 1 &&
        tile(images[0], 0, "w-full max-h-[320px] rounded-[14px] border border-border", undefined, {
          aspectRatio: images[0].width && images[0].height ? `${images[0].width / images[0].height}` : "4 / 3",
        })}
      {images.length > 1 && (
        <div className="grid grid-cols-2 gap-[5px] overflow-hidden rounded-[14px] border border-border">
          {images.slice(0, 4).map((a, i) =>
            tile(
              a,
              i,
              "h-[104px] w-full",
              i === 3 && images.length > 4 ? (
                <span className="absolute inset-0 grid place-items-center bg-[rgba(10,10,10,0.55)] text-[18px] font-semibold text-white">+{images.length - 3}</span>
              ) : undefined,
            ),
          )}
        </div>
      )}
      {files.map((a) => {
        const Icon = FILE_ICONS[fileKind(a.mime_type, a.file_name) as Exclude<FileKind, "image">] ?? File;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => void openFile(a)}
            className="flex w-full items-center gap-[12px] rounded-[12px] border border-border bg-bg-card px-[12px] py-[11px] text-left active:bg-bg-subtle"
          >
            <span className="grid size-[40px] shrink-0 place-items-center rounded-[10px] border border-border-subtle bg-bg-chip text-fg-600">
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-ink">{a.file_name}</span>
              <span className="mt-[2px] block truncate text-[12px] text-muted-foreground">
                {formatBytes(a.size_bytes)}
                {a.mime_type ? ` · ${a.mime_type.split("/")[1]?.toUpperCase().slice(0, 8)}` : ""}
              </span>
            </span>
            <ChevronRight className="size-[16px] shrink-0 text-tertiary" aria-hidden="true" />
          </button>
        );
      })}
      {viewing !== null && (
        <ImageViewer images={images} urls={urls ?? {}} start={viewing} onClose={() => setViewing(null)} actions={actions} />
      )}
    </div>
  );
}

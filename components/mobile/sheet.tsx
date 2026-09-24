"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** How far a drag on the grabber has to travel, or how fast, before letting go closes the sheet. */
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.55; // px per ms

/**
 * A bottom sheet (design: Mobile Touch): a 20px-radius card that rises from
 * the bottom edge over a dimmed scrim, with a grabber you can drag down to
 * close. `above` floats over the scrim just above the sheet, which is where
 * the long-press quick reactions and the lifted message sit.
 *
 * Built on Radix Dialog, so focus is trapped, Escape and the scrim close it,
 * and screen readers get a titled dialog.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  above,
  maxHeight = "86dvh",
  blur = true,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read by screen readers; the sheet draws its own visible heading when it has one. */
  title: string;
  above?: React.ReactNode;
  maxHeight?: string;
  /** The long-press sheet blurs what is behind it; pickers only dim it. */
  blur?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { y: e.touches[0].clientY, t: e.timeStamp };
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    setDrag(Math.max(0, e.touches[0].clientY - start.current.y));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const dy = (e.changedTouches[0]?.clientY ?? start.current.y) - start.current.y;
    const velocity = dy / Math.max(1, e.timeStamp - start.current.t);
    start.current = null;
    setDragging(false);
    // Closing keeps the offset, so the sheet leaves from where the finger let go.
    if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onOpenChange(false);
    else setDrag(0);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn("sheet-scrim fixed inset-0 z-50", blur ? "bg-[rgba(10,10,10,0.55)] backdrop-blur-[2px]" : "bg-[rgba(10,10,10,0.45)]")}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={() => setDrag(0)}
          className="sheet-panel fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end outline-none"
          style={{
            maxHeight,
            transform: drag ? `translateY(${drag}px)` : undefined,
            transition: dragging ? "none" : undefined,
          }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {above && <div className="shrink-0 px-[14px] pb-[10px]">{above}</div>}
          <div
            className={cn(
              "flex min-h-0 flex-col rounded-t-[20px] border-t border-border bg-bg-card pb-[calc(10px+var(--safe-bottom))] shadow-[0_-10px_34px_-8px_rgba(0,0,0,0.45)]",
              className,
            )}
          >
            <div
              className="shrink-0 touch-none pt-[9px] pb-[4px]"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
            >
              <span aria-hidden="true" className="mx-auto block h-[4px] w-[36px] rounded-full bg-border-hover" />
            </div>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** One action in a sheet: 52px, an 18px icon, 15/500. The irreversible one sits last and red. */
export function SheetAction({
  icon,
  onSelect,
  tone = "default",
  disabled,
  children,
}: {
  icon: React.ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex min-h-[52px] w-full shrink-0 items-center gap-[14px] border-t border-border-subtle px-[18px] text-left text-[15px] font-medium active:bg-bg-hover disabled:opacity-50 [&>svg]:size-[18px] [&>svg]:shrink-0",
        tone === "danger" ? "text-danger [&>svg]:text-danger" : "text-ink [&>svg]:text-fg-600",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

/** A sheet's own heading row, for sheets that have one (a picker, a form). */
export function SheetHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-[8px] px-[18px] pt-[4px] pb-[10px]">
      <h2 className="min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.015em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

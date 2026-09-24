"use client";

import { useEffect, useRef, useState } from "react";
import { native } from "@/lib/native";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  label: string;
  icon: React.ReactNode;
  /** Accent for the one that changes something; neutral for the rest. Nothing here is irreversible, so nothing is red. */
  tone?: "neutral" | "accent";
  onSelect: () => void;
};

const ACTION_WIDTH = 82;
const SLOP = 9;

/** Only one row stays open: opening another closes it. */
let closeOpenRow: (() => void) | null = null;

/**
 * A list row that swipes left to reveal its actions (design: Mobile Touch →
 * Swipe a list row): two at most, 82px each, the row sliding over them with a
 * shadow on its edge. Past halfway it stays open; tapping the row then closes
 * it rather than opening the conversation.
 */
export function SwipeRow({ actions, children }: { actions: SwipeAction[]; children: React.ReactNode }) {
  const width = actions.length * ACTION_WIDTH;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const open = useRef(false);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const mode = useRef<"idle" | "swipe" | "scroll">("idle");
  const swallowClick = useRef(false);

  const close = () => {
    open.current = false;
    setOffset(0);
    if (closeOpenRow === close) closeOpenRow = null;
  };
  useEffect(
    () => () => {
      if (closeOpenRow === close) closeOpenRow = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, base: open.current ? -width : 0 };
    mode.current = "idle";
    swallowClick.current = open.current;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    if (mode.current === "idle") {
      if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) mode.current = "scroll";
      else if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy) * 1.2) {
        mode.current = "swipe";
        if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
        setDragging(true);
      }
    }
    if (mode.current === "swipe") {
      swallowClick.current = true;
      // A little give past the actions, then it stops.
      const raw = start.current.base + dx;
      setOffset(raw < -width ? -width - (-width - raw) * 0.25 : Math.min(0, raw));
    }
  };
  const onTouchEnd = () => {
    if (mode.current === "swipe") {
      const shouldOpen = offset < -width / 2;
      if (shouldOpen && !open.current) native.haptic("light");
      open.current = shouldOpen;
      setOffset(shouldOpen ? -width : 0);
      if (shouldOpen) closeOpenRow = close;
    }
    setDragging(false);
    start.current = null;
    mode.current = "idle";
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width }} aria-hidden={offset === 0}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={offset === 0 ? -1 : 0}
            onClick={() => {
              close();
              a.onSelect();
            }}
            className={cn(
              "flex w-[82px] shrink-0 flex-col items-center justify-center gap-[5px] text-[11px] font-semibold [&>svg]:size-[19px]",
              a.tone === "accent" ? "bg-primary text-white" : "bg-bg-subtle text-fg-400",
            )}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
          if (open.current && mode.current === "idle") close();
        }}
        className={cn("relative touch-pan-y bg-bg-main", !dragging && "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]")}
        style={offset ? { transform: `translateX(${offset}px)`, boxShadow: "6px 0 12px -6px var(--shadow-tint-lg)" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

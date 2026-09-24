"use client";

import { useEffect, useRef, useState } from "react";
import { native } from "@/lib/native";

/** Hold this long without moving and it is a long-press. */
const LONG_PRESS_MS = 420;
/** Movement that turns a press into a scroll or a swipe. */
const SLOP = 9;
/** How far a swipe has to travel before letting go commits it. */
const SWIPE_COMMIT = 64;
const SWIPE_MAX = 88;

/**
 * Touch gestures for a list row (design: Mobile Touch): hold to open its
 * action sheet, and — where a row has one — swipe right to reply. Vertical
 * movement is left to the browser (the row sets `touch-action: pan-y`), so
 * scrolling a list never fights the gestures.
 *
 * Returns the handlers to spread on the row, the current swipe offset to
 * draw, and whether the swipe has reached its commit point.
 */
export function useRowGestures({
  enabled,
  onLongPress,
  onSwipe,
}: {
  enabled: boolean;
  onLongPress: () => void;
  /** Right swipe past the commit point; omit for rows that have no swipe. */
  onSwipe?: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"idle" | "press" | "swipe" | "scroll">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const armed = useRef(false);
  /** When the last long-press fired: the click a release can produce right after is not a tap. */
  const pressedAt = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const reset = () => {
    clearTimeout(timer.current);
    start.current = null;
    mode.current = "idle";
    armed.current = false;
    setOffset(0);
  };

  const handlers = enabled
    ? {
        onTouchStart: (e: React.TouchEvent) => {
          // Touches in a sheet this row opened reach it through React's tree, not the page's; leave them be.
          if (!(e.currentTarget as HTMLElement).contains(e.target as Node)) return;
          if (e.touches.length !== 1) return reset();
          const t = e.touches[0];
          start.current = { x: t.clientX, y: t.clientY };
          mode.current = "press";
          pressedAt.current = 0;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            if (mode.current !== "press") return;
            pressedAt.current = Date.now();
            mode.current = "idle";
            native.haptic("medium");
            onLongPress();
          }, LONG_PRESS_MS);
        },
        onTouchMove: (e: React.TouchEvent) => {
          if (!start.current) return;
          const t = e.touches[0];
          const dx = t.clientX - start.current.x;
          const dy = t.clientY - start.current.y;
          if (mode.current === "press") {
            if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {
              clearTimeout(timer.current);
              mode.current = "scroll";
            } else if (onSwipe && dx > SLOP && dx > Math.abs(dy) * 1.4) {
              clearTimeout(timer.current);
              mode.current = "swipe";
            } else if (Math.abs(dx) > SLOP) {
              clearTimeout(timer.current);
              mode.current = "scroll";
            }
          }
          if (mode.current === "swipe") {
            const next = Math.max(0, Math.min(SWIPE_MAX, dx * 0.7));
            setOffset(next);
            const past = next >= SWIPE_COMMIT;
            if (past !== armed.current) {
              armed.current = past;
              if (past) native.haptic("light");
            }
          }
        },
        onTouchEnd: () => {
          const commit = mode.current === "swipe" && armed.current;
          reset();
          if (commit) onSwipe?.();
        },
        onTouchCancel: reset,
        // Android turns a long-press into a context menu; the sheet replaces it.
        onContextMenu: (e: React.MouseEvent) => {
          if ((e.currentTarget as HTMLElement).contains(e.target as Node)) e.preventDefault();
        },
        // A long-press can end with a click on whatever was under the finger; swallow that one.
        // Only on the row itself: the sheet it opened is a portal, and React bubbles its clicks
        // through this row too.
        onClickCapture: (e: React.MouseEvent) => {
          if (!pressedAt.current || !(e.currentTarget as HTMLElement).contains(e.target as Node)) return;
          const recent = Date.now() - pressedAt.current < 1000;
          pressedAt.current = 0;
          if (!recent) return;
          e.preventDefault();
          e.stopPropagation();
        },
      }
    : {};

  return { handlers, offset, committed: offset >= SWIPE_COMMIT, swiping: offset > 0 };
}

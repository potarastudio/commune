"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { native } from "@/lib/native";
import { unreadKeys } from "@/lib/queries/unreads";
import { cn } from "@/lib/utils";
import { SCROLL_TO_TOP_EVENT } from "./use-mobile-nav";

/** How far the list has to come down before letting go refreshes it, and how far it can be dragged. */
const PULL_THRESHOLD = 72;
const PULL_MAX = 112;

/**
 * A tab root's scrolling list. Tapping its tab again scrolls it to the top.
 *
 * With `refreshLabel` it also pulls to refresh (design: Mobile Touch → Pull
 * to refresh): only where the data is genuinely polled, and the label says
 * what is being fetched, because a bare spinner reads as a hang. The list is
 * server-rendered, so a refresh re-runs the page and holds the list down until
 * the new one has landed.
 */
export function TabScroll({
  tab,
  refreshLabel,
  className,
  children,
}: {
  tab: string;
  refreshLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    const onReselect = (e: Event) => {
      if ((e as CustomEvent<string>).detail === tab) ref.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener(SCROLL_TO_TOP_EVENT, onReselect);
    return () => window.removeEventListener(SCROLL_TO_TOP_EVENT, onReselect);
  }, [tab]);

  const canPull = Boolean(refreshLabel);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!canPull || refreshing || (ref.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
    armed.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0 || (ref.current?.scrollTop ?? 0) > 0) {
      setDragging(false);
      setPull(0);
      return;
    }
    // Resistance: the list moves at half the finger's speed, like the system's own overscroll.
    const next = Math.min(PULL_MAX, dy * 0.5);
    setDragging(true);
    setPull(next);
    const past = next >= PULL_THRESHOLD;
    if (past !== armed.current) {
      armed.current = past;
      if (past) native.haptic("light");
    }
  };

  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    setPull(0);
    if (!armed.current) return;
    armed.current = false;
    void queryClient.invalidateQueries({ queryKey: unreadKeys.all });
    startRefresh(() => router.refresh());
  };

  // While the refresh is out, the list holds at the threshold; it settles once the new render lands.
  const offset = refreshing ? PULL_THRESHOLD : pull;
  const shown = Math.min(1, offset / PULL_THRESHOLD);

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden", canPull && "bg-bg-col")}>
      {canPull && (
        <div
          aria-hidden={!refreshing}
          className="pointer-events-none absolute inset-x-0 top-0 flex h-[72px] flex-col items-center justify-center gap-[7px]"
          style={{ opacity: shown }}
        >
          <span
            className={cn(
              "block size-[22px] rounded-full border-2 border-border-hover border-t-primary",
              refreshing && "animate-[commune-spin_700ms_linear_infinite]",
            )}
            style={refreshing ? undefined : { transform: `rotate(${offset * 5}deg)` }}
          />
          <span role={refreshing ? "status" : undefined} className="text-[11.5px] font-semibold text-muted-foreground">
            {refreshLabel}
          </span>
        </div>
      )}
      <div
        ref={ref}
        onTouchStart={canPull ? onTouchStart : undefined}
        onTouchMove={canPull ? onTouchMove : undefined}
        onTouchEnd={canPull ? onTouchEnd : undefined}
        onTouchCancel={canPull ? onTouchEnd : undefined}
        className={cn(
          "absolute inset-0 overflow-y-auto bg-bg-main",
          // The pull replaces the rubber band here; elsewhere the list keeps it but never chains to the page.
          canPull ? "overscroll-y-none" : "overscroll-contain",
          offset > 0 && "border-t border-border",
          !dragging && "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          className,
        )}
        style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

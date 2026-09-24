"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Where the minimised huddle bar goes. Every phone screen header renders an
 * outlet and the live room (components/mobile/huddle.tsx, loaded only during a
 * huddle) portals the bar into the newest one — the same arrangement as the
 * desktop stage (huddle-stage-slot.tsx). Kept apart from the bar itself so the
 * headers, which every page draws, never import LiveKit.
 */
let barHost: HTMLElement | null = null;
const barListeners = new Set<() => void>();

function setBarHost(el: HTMLElement | null) {
  if (barHost === el) return;
  barHost = el;
  for (const l of barListeners) l();
}

/** Stable, so React attaches it once; the cleanup only lets go if no newer header has taken over. */
function outletRef(el: HTMLDivElement | null) {
  if (!el) return;
  setBarHost(el);
  return () => {
    if (barHost === el) setBarHost(null);
  };
}

function subscribeBarHost(onChange: () => void) {
  barListeners.add(onChange);
  return () => {
    barListeners.delete(onChange);
  };
}

/** Rendered under each phone screen header. Empty unless you are in a huddle. */
export function MobileHuddleBarOutlet() {
  return <div className="contents" ref={outletRef} />;
}

/** The outlet the bar should portal into right now, if any. */
export function useHuddleBarHost(): HTMLElement | null {
  return useSyncExternalStore(
    subscribeBarHost,
    useCallback(() => barHost, []),
    useCallback(() => null, []),
  );
}

"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { HuddleSession } from "@/lib/store/huddle";
import { HuddleStage } from "./huddle-stage";

/**
 * The huddle route and the huddle connection live in different parts of the
 * tree, and each needs the other.
 *
 * The stage reads LiveKit hooks, so it has to render under LiveKitRoom, which
 * the provider owns. It also has to appear where the route's content goes. A
 * portal satisfies both: React context follows the React tree, and only the
 * DOM node moves. Without it the provider would have to wrap the whole app,
 * which is what put ~170 KB of LiveKit on every page.
 *
 * The route publishes its container through a ref rather than an id lookup, so
 * the portal never has to guess whether the node exists yet.
 */
let host: HTMLElement | null = null;
const listeners = new Set<() => void>();

function setHost(el: HTMLElement | null) {
  if (host === el) return;
  host = el;
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Rendered by the huddle route. `display: contents` keeps it out of the layout. */
export function HuddleStageOutlet() {
  return <div className="contents" ref={setHost} />;
}

/** Rendered by the provider, inside the live room. */
export function HuddleStageSlot({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const target = useSyncExternalStore(
    subscribe,
    useCallback(() => host, []),
    useCallback(() => null, []),
  );
  if (!target) return null;
  return createPortal(<HuddleStage session={session} onLeave={onLeave} />, target);
}

"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False on the server and during the hydration render, true from the next
 * render on.
 *
 * For UI whose data only exists in the browser. A TanStack query backed by the
 * Supabase browser client has nothing to return on the server, so anything
 * drawn from it renders empty in the HTML and populated on the client, and
 * React reports a hydration mismatch. Gating on this makes the first client
 * render agree with the server, and the content appears a frame later.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}

"use client";

import { createContext, useContext } from "react";

/**
 * Whether this page is the phone interface. Decided on the server from the
 * user agent (lib/mobile-server.ts) and handed down by the app layout, so the
 * server render and hydration agree. Components that differ on a phone — the
 * message row's geometry, the composer's chrome, long-press instead of hover —
 * read it here rather than sniffing the viewport, which the server cannot see.
 */
const MobileContext = createContext(false);

export function MobileProvider({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  return <MobileContext.Provider value={mobile}>{children}</MobileContext.Provider>;
}

export function useIsMobile(): boolean {
  return useContext(MobileContext);
}

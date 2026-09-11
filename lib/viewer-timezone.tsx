"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIMEZONE, safeTimeZone } from "@/lib/utils/time";

/**
 * The signed-in viewer's time zone, from their profile, for every time the
 * app draws (§6).
 *
 * It is handed down by app/(app)/layout.tsx, which has the profile on the
 * server, so the server render and the browser's hydration read the same
 * value. Do not replace this with useProfileMap() or any TanStack query: those
 * load only in the browser, so the server would render one zone and the
 * browser another (see lib/utils/use-hydrated.ts for how that went before).
 */
const ViewerTimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

export function ViewerTimezoneProvider({ timezone, children }: { timezone: string | null | undefined; children: React.ReactNode }) {
  return <ViewerTimezoneContext.Provider value={safeTimeZone(timezone)}>{children}</ViewerTimezoneContext.Provider>;
}

export function useViewerTimezone(): string {
  return useContext(ViewerTimezoneContext);
}

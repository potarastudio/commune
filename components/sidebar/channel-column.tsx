"use client";

import { usePathname } from "next/navigation";

/**
 * Settings brings its own 248px column, so the channel column steps aside there
 * — the design's Settings artboards show the rail, the Settings aside and the
 * pane, and no channel list. The column is still server-rendered and handed in
 * as children; this only decides whether it mounts.
 */
export function ChannelColumn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return null;
  return <>{children}</>;
}

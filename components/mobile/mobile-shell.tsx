"use client";

import { rootTabOf } from "@/lib/mobile";
import type { UnreadMap } from "@/lib/utils/unreads";
import { IncomingHuddles } from "./incoming-huddle";
import { NavSync } from "./nav-sync";
import { PushPrimer } from "./push-primer";
import { TabBar } from "./tab-bar";
import { useCurrentUrl } from "./use-mobile-nav";

/**
 * The phone's app shell (design: Mobile Navigation). One screen at a time,
 * under the status bar's inset; tab roots carry the tab bar, pushed screens
 * and surfaces draw their own bottom (a composer, or nothing).
 */
export function MobileShell({
  me,
  initialUnreads,
  mutedChannelIds,
  children,
}: {
  me: { id: string; display_name: string; avatar_url: string | null };
  initialUnreads: UnreadMap;
  mutedChannelIds: string[];
  children: React.ReactNode;
}) {
  const url = useCurrentUrl();
  const tab = rootTabOf(url);
  return (
    <div className="mobile-app pt-safe flex h-dvh flex-col overflow-hidden bg-bg-main">
      <NavSync />
      <IncomingHuddles meId={me.id} />
      <PushPrimer />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {tab && <TabBar active={tab} me={me} initialUnreads={initialUnreads} mutedChannelIds={mutedChannelIds} />}
    </div>
  );
}

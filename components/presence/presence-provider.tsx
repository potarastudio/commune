"use client";

import { useOnlinePresence } from "@/lib/realtime/presence";

/** Mounted once in the app shell: keeps the online set live for the whole session. */
export function PresenceProvider({ meId }: { meId: string }) {
  useOnlinePresence(meId);
  return null;
}

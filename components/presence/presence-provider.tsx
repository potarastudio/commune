"use client";

import { useEffect } from "react";
import { touchPresenceAction } from "@/lib/actions/profile";
import { useOnlinePresence } from "@/lib/realtime/presence";

const HEARTBEAT_MS = 60_000;

/** Mounted once in the app shell: keeps the online set live for the whole session. */
export function PresenceProvider({ meId }: { meId: string }) {
  useOnlinePresence(meId);
  useLastSeenHeartbeat();
  return null;
}

/**
 * Persists "last seen" while the tab is visible so the mention digest knows
 * who is away. Realtime presence is per-connection and gone the moment the
 * tab closes; this survives it.
 */
function useLastSeenHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const beat = () => void touchPresenceAction();
    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);
}

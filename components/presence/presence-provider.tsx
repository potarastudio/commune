"use client";

import { useEffect } from "react";
import { touchPresenceAction } from "@/lib/actions/profile";
import { useCustomEmoji } from "@/lib/queries/custom-emoji";
import { useProfilesRealtime } from "@/lib/queries/profiles";
import { useSessionStore } from "@/lib/store/session";
import { useOnlinePresence } from "@/lib/realtime/presence";

const HEARTBEAT_MS = 60_000;

/** Mounted once in the app shell: keeps the online set live for the whole session. */
export function PresenceProvider({ meId }: { meId: string }) {
  const setMeId = useSessionStore((s) => s.setMeId);
  useEffect(() => setMeId(meId), [meId, setMeId]);
  useOnlinePresence(meId);
  useProfilesRealtime();
  useCustomEmoji(); // keeps the custom emoji set cached for rendering and the composer
  useLastSeenHeartbeat();
  return null;
}

/**
 * Persists "last seen" while the tab is visible so the mention digest knows
 * who is away. Realtime presence is per-connection and gone the moment the
 * tab closes; this survives it.
 *
 * The first beat is deferred a tick on purpose. touchPresenceAction is a server
 * action, and calling one inside the hydration commit makes Next's router
 * re-render while React is still hydrating, which throws "Rendered more hooks
 * than during the previous render" and drops the whole page onto the global
 * error screen. Nothing depends on the heartbeat landing immediately — it is a
 * once-a-minute timestamp — so it waits until hydration is done.
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

    const kickoff = setTimeout(onVisibility, 0);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(kickoff);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);
}

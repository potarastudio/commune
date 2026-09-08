"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePresenceStore } from "@/lib/store/presence";
import type { Container } from "@/lib/queries/messages";
import { acquirePresence, type PresenceHandle } from "./presence-channel";

/**
 * Presence (§7): one workspace-wide topic for online dots, one per-container
 * topic for typing. Channels are shared and reference-counted per topic.
 */

type OnlineMeta = { user_id: string; online_at: string };

/** Tracks me as online and mirrors everyone else into the presence store. */
export function useOnlinePresence(meId: string) {
  const setOnline = usePresenceStore((s) => s.setOnline);

  useEffect(() => {
    const handle = acquirePresence("presence:online", meId, (state) => setOnline(Object.keys(state)));
    void handle.track({ user_id: meId, online_at: new Date().toISOString() } satisfies OnlineMeta);

    // Re-announce when the tab comes back, in case the connection was dropped while hidden.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void handle.track({ user_id: meId, online_at: new Date().toISOString() } satisfies OnlineMeta);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      handle.release();
      setOnline([]);
    };
  }, [meId, setOnline]);
}

type TypingMeta = { user_id: string; name: string; at: number };

/** Sender: untrack after this much silence (§7). */
const TYPING_IDLE_MS = 3000;
/** Receiver: safety net if an untrack is lost; presence itself is the signal. */
const TYPING_MAX_AGE_MS = 20_000;

/**
 * Typing in one container. Presence updates are rate-limited per client by
 * Realtime, so we track once when typing starts and untrack after 3 s of
 * silence, rather than re-tracking on every keystroke.
 */
export function useTyping(container: Container, me: { id: string; name: string }) {
  const [others, setOthers] = useState<{ id: string; name: string }[]>([]);
  const handleRef = useRef<PresenceHandle | null>(null);
  const tracked = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef<Record<string, TypingMeta[]>>({});

  const recompute = useCallback(() => {
    const now = Date.now();
    const fresh: { id: string; name: string }[] = [];
    for (const [key, metas] of Object.entries(stateRef.current)) {
      const latest = metas[metas.length - 1];
      if (key === me.id || !latest) continue;
      if (now - latest.at < TYPING_MAX_AGE_MS) fresh.push({ id: latest.user_id, name: latest.name });
    }
    setOthers((prev) => (prev.length === fresh.length && prev.every((p, i) => p.id === fresh[i].id) ? prev : fresh));
  }, [me.id]);

  const stopTyping = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (!tracked.current) return;
    tracked.current = false;
    void handleRef.current?.untrack();
  }, []);

  useEffect(() => {
    const topic = `typing:${container.kind}:${container.id}`;
    const handle = acquirePresence(topic, me.id, (state) => {
      stateRef.current = state as Record<string, TypingMeta[]>;
      recompute();
    });
    handleRef.current = handle;
    const timer = setInterval(recompute, 2000);

    return () => {
      clearInterval(timer);
      clearTimeout(idleTimer.current);
      tracked.current = false;
      handleRef.current = null;
      stateRef.current = {};
      setOthers([]);
      handle.release();
    };
  }, [container.kind, container.id, me.id, recompute]);

  const onKeystroke = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    if (tracked.current) return;
    tracked.current = true;
    void handleRef.current?.track({ user_id: me.id, name: me.name, at: Date.now() } satisfies TypingMeta);
  }, [me.id, me.name, stopTyping]);

  return { others, onKeystroke, stopTyping };
}

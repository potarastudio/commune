"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { joinHuddleAction, leaveHuddleAction, startHuddleAction } from "@/lib/actions/huddles";
import type { Container } from "@/lib/queries/messages";
import { useHuddleStore, type HuddleSession } from "@/lib/store/huddle";
import { humanError } from "@/lib/utils/human-error";

type HuddleRoomProps = {
  session: HuddleSession;
  onStage: boolean;
  onLeave: () => void;
  onDisconnected: () => void;
};

/**
 * Held in a module variable and in state rather than wrapped in next/dynamic,
 * so the no-huddle tree is byte-identical on server and client.
 */
let cached: ComponentType<HuddleRoomProps> | undefined;

async function loadHuddleRoom(): Promise<ComponentType<HuddleRoomProps>> {
  cached ??= (await import("./huddle-room")).default;
  return cached;
}

/**
 * Keeps the LiveKit connection alive across navigation (§5: docked mini-view
 * while you keep chatting). Mounted once in the app shell; the dock renders
 * here, and the full-screen stage portals into the route from the same room.
 *
 * The connection renders *beside* children, never around them, so starting a
 * huddle cannot remount the app and no page pays for LiveKit until someone is
 * actually in a call. It is ~170 KB gzipped, and almost nobody is in a call.
 */
export function HuddleProvider({ children }: { children: React.ReactNode }) {
  const session = useHuddleStore((s) => s.session);
  const connecting = useHuddleStore((s) => s.connecting);
  const clear = useHuddleStore((s) => s.clear);
  const pathname = usePathname();
  const router = useRouter();
  const onStage = pathname.startsWith("/huddle/");
  const leaving = useRef(false);
  const [Room, setRoom] = useState<ComponentType<HuddleRoomProps> | null>(() => cached ?? null);

  const leave = useCallback(async () => {
    const current = useHuddleStore.getState().session;
    if (!current || leaving.current) return;
    leaving.current = true;
    clear();
    // The stage has nothing left to show once the room is gone; the dock just
    // disappears in place.
    if (window.location.pathname.startsWith("/huddle/")) router.push(current.href);
    try {
      await leaveHuddleAction({ huddleId: current.huddleId });
    } finally {
      leaving.current = false;
    }
  }, [clear, router]);

  // enterHuddle flips `connecting` before it asks for a token, so the chunk
  // downloads alongside that round-trip instead of after it.
  useEffect(() => {
    if (!connecting && !session) return;
    let alive = true;
    void loadHuddleRoom().then((c) => {
      if (alive) setRoom(() => c);
    });
    return () => {
      alive = false;
    };
  }, [connecting, session]);

  // Closing the tab: tell the server with a beacon so the huddle can end for others.
  useEffect(() => {
    if (!session) return;
    const onUnload = () => {
      navigator.sendBeacon("/api/livekit/leave", new Blob([JSON.stringify({ huddleId: session.huddleId })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [session]);

  return (
    <>
      {children}
      {session && Room && (
        <Room
          session={session}
          onStage={onStage}
          onLeave={() => void leave()}
          onDisconnected={() => {
            if (useHuddleStore.getState().session) void leave();
          }}
        />
      )}
    </>
  );
}

/** Start (or join the running) huddle in a container and connect this browser. */
export async function enterHuddle(input: { container: Container; label: string; href: string; huddleId?: string }): Promise<boolean> {
  const store = useHuddleStore.getState();
  if (store.session) {
    if (store.session.huddleId === input.huddleId) return true;
    toast.error("You're already in a huddle", { description: `Leave ${store.session.label} first.` });
    return false;
  }
  store.setConnecting(true);
  try {
    let huddleId = input.huddleId;
    if (!huddleId) {
      const started = await startHuddleAction({ container: input.container });
      if (!started.ok) throw new Error(started.error);
      huddleId = started.data.id;
    }
    const joined = await joinHuddleAction({ huddleId });
    if (!joined.ok) throw new Error(joined.error);

    const res = await fetch(`/api/livekit/token?huddle=${huddleId}`, { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Couldn't connect you to the huddle." }))).error ?? "Couldn't connect you to the huddle.");
    const { token, url, room } = (await res.json()) as { token: string; url: string; room: string };

    const session: HuddleSession = { huddleId, room, token, url, container: input.container, label: input.label, href: input.href };
    store.start(session);
    return true;
  } catch (err) {
    store.setConnecting(false);
    toast.error("Couldn't join the huddle", { description: humanError(err, "Check your connection and try again.") });
    return false;
  }
}

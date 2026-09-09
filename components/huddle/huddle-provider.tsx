"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { joinHuddleAction, leaveHuddleAction, startHuddleAction } from "@/lib/actions/huddles";
import type { Container } from "@/lib/queries/messages";
import { useHuddleStore, type HuddleSession } from "@/lib/store/huddle";
import { HuddleDock } from "./huddle-dock";

/**
 * Keeps the LiveKit connection alive across navigation (§5: docked mini-view
 * while you keep chatting). Mounted once in the app shell; the dock renders
 * here, the full-screen stage reads the same room context.
 */
export function HuddleProvider({ children }: { children: React.ReactNode }) {
  const session = useHuddleStore((s) => s.session);
  const clear = useHuddleStore((s) => s.clear);
  const pathname = usePathname();
  const onStage = pathname.startsWith("/huddle/");
  const leaving = useRef(false);

  const leave = useCallback(async () => {
    const current = useHuddleStore.getState().session;
    if (!current || leaving.current) return;
    leaving.current = true;
    clear();
    try {
      await leaveHuddleAction({ huddleId: current.huddleId });
    } finally {
      leaving.current = false;
    }
  }, [clear]);

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
    <LiveKitRoom
      serverUrl={session?.url}
      token={session?.token}
      connect={Boolean(session)}
      audio={Boolean(session)}
      video={false}
      onDisconnected={() => {
        if (useHuddleStore.getState().session) void leave();
      }}
      onMediaDeviceFailure={(failure) => {
        toast("Microphone unavailable", {
          description:
            failure === "PermissionDenied"
              ? "The browser blocked the microphone. You can listen, and you can allow it in the site settings to talk."
              : "No microphone was found. You can still listen.",
        });
      }}
      onError={(err) => {
        if (err.name === "NotAllowedError" || err.name === "NotFoundError") return; // handled above
        console.error("livekit", err);
        toast.error("Huddle connection problem", { description: err.message });
      }}
      className="contents"
    >
      {children}
      <RoomAudioRenderer />
      {session && !onStage && <HuddleDock session={session} onLeave={() => void leave()} />}
    </LiveKitRoom>
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
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Couldn't get a token." }))).error ?? "Couldn't get a token.");
    const { token, url, room } = (await res.json()) as { token: string; url: string; room: string };

    const session: HuddleSession = { huddleId, room, token, url, container: input.container, label: input.label, href: input.href };
    store.start(session);
    return true;
  } catch (err) {
    store.setConnecting(false);
    toast.error("Couldn't join the huddle", { description: err instanceof Error ? err.message : undefined });
    return false;
  }
}

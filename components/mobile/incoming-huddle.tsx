"use client";

import { useEffect } from "react";
import { playHuddleSound } from "@/lib/audio/sounds";
import { native } from "@/lib/native";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { useHuddleStore } from "@/lib/store/huddle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMobileNav } from "./use-mobile-nav";

/**
 * A huddle someone starts in one of your DMs rings on the phone (design:
 * Mobile Huddle → Invited): the huddle screen opens with who is talking and a
 * Join and a Not now. Channel huddles do not ring; their banner is enough, and
 * a channel is a room, not a call. Realtime only delivers the huddles RLS lets
 * you read, so a DM you are not in never reaches here.
 */
export function IncomingHuddles({ meId }: { meId: string }) {
  const nav = useMobileNav();
  useEffect(() => {
    const stop = subscribeWithAuth(
      getSupabaseBrowserClient(),
      "incoming-huddles",
      (channel) =>
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "huddles" }, (payload) => {
          const row = payload.new as { id: string; conversation_id: string | null; started_by: string | null };
          if (!row.conversation_id || row.started_by === meId) return;
          if (useHuddleStore.getState().session) return;
          if (document.visibilityState !== "visible") return;
          native.haptic("medium");
          playHuddleSound("peerJoined");
          nav.push(`/huddle/${row.id}`);
        }),
    );
    return stop;
  }, [meId, nav]);
  return null;
}

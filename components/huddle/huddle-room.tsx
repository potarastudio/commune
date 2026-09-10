"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { toast } from "sonner";
import type { HuddleSession } from "@/lib/store/huddle";
import { HuddleDock } from "./huddle-dock";
import { HuddleSounds } from "./huddle-sounds";
import { HuddleStageSlot } from "./huddle-stage-slot";

/**
 * Everything that needs a live LiveKit connection, loaded on demand.
 *
 * This renders beside the app rather than around it. Wrapping the app meant
 * every page downloaded LiveKit, and lazily wrapping it after hydration
 * remounted the entire tree. As a sibling it can appear and disappear without
 * touching anything else on the page; the stage reaches its place in the
 * content area through a portal.
 */
export default function HuddleRoom({
  session,
  onStage,
  onLeave,
  onDisconnected,
}: {
  session: HuddleSession;
  onStage: boolean;
  onLeave: () => void;
  onDisconnected: () => void;
}) {
  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      connect
      audio
      video={false}
      onDisconnected={onDisconnected}
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
      <RoomAudioRenderer />
      <HuddleSounds />
      {onStage ? (
        <HuddleStageSlot session={session} onLeave={onLeave} />
      ) : (
        <HuddleDock session={session} onLeave={onLeave} />
      )}
    </LiveKitRoom>
  );
}

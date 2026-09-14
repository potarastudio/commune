"use client";

import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
import { RoomEvent, Track, type LocalTrackPublication, type RoomOptions } from "livekit-client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { HuddleSession } from "@/lib/store/huddle";
import { useHuddleDevices } from "@/lib/store/huddle-devices";
import { findRemembered, rememberedDevices } from "@/lib/utils/media-devices";
import { HuddleDock } from "./huddle-dock";
import { HuddleSounds } from "./huddle-sounds";
import { HuddleStageSlot } from "./huddle-stage-slot";

const MEDIA_KINDS = ["audioinput", "videoinput", "audiooutput"] as const;

/**
 * The second half of starting on remembered devices. Before joining, a browser
 * that holds no lasting permission (Chrome's "Allow this time", Safari) hides
 * device ids, so the room may open the system default. Once a microphone or
 * camera is live the ids are visible, and this moves each one onto the device
 * picked last time, if it is plugged in.
 */
function RememberedDevices() {
  const room = useRoomContext();
  useEffect(() => {
    let running = false;
    let again = false;
    const apply = async () => {
      // A track published while a pass is still reading the device list must not be dropped.
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const saved = useHuddleDevices.getState();
        const available = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        for (const kind of MEDIA_KINDS) {
          const id = findRemembered(saved[kind], available, kind);
          // "default" is what the room opens anyway; restarting onto it would only glitch the audio.
          if (!id || id === "default" || room.getActiveDevice(kind) === id) continue;
          const source = kind === "audioinput" ? Track.Source.Microphone : kind === "videoinput" ? Track.Source.Camera : null;
          if (source && !room.localParticipant.getTrackPublication(source)) continue;
          await room.switchActiveDevice(kind, id).catch((err: unknown) => console.warn("remembered device", { kind, err }));
        }
      } finally {
        running = false;
      }
      if (again) {
        again = false;
        await apply();
      }
    };
    const onPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Microphone || publication.source === Track.Source.Camera) void apply();
    };
    room.on(RoomEvent.LocalTrackPublished, onPublished).on(RoomEvent.Connected, apply);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPublished).off(RoomEvent.Connected, apply);
    };
  }, [room]);
  return null;
}

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
  // Start on the devices picked last time, if they are still plugged in.
  // Settled once, before the room exists: LiveKitRoom builds a new Room
  // whenever its options change, which would drop the call.
  const [options, setOptions] = useState<RoomOptions | null>(null);
  useEffect(() => {
    let live = true;
    const saved = useHuddleDevices.getState();
    void (navigator.mediaDevices?.enumerateDevices() ?? Promise.resolve([]))
      .catch(() => [])
      .then((available) => {
        if (live) setOptions(rememberedDevices(saved, available));
      });
    return () => {
      live = false;
    };
  }, []);
  if (!options) return null;

  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      options={options}
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
      <RememberedDevices />
      <HuddleSounds />
      {onStage ? (
        <HuddleStageSlot session={session} onLeave={onLeave} />
      ) : (
        <HuddleDock session={session} onLeave={onLeave} />
      )}
    </LiveKitRoom>
  );
}

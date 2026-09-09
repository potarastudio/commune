"use client";

import { VideoTrack, useConnectionState, useLocalParticipant, useParticipants, useTracks, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { ChevronDown, MicOff, MonitorUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HuddleSession } from "@/lib/store/huddle";
import { HuddleControls, useHuddleTimer } from "./huddle-controls";
import { ParticipantTile } from "./participant-bubble";

function hasTrack(ref: TrackReferenceOrPlaceholder): ref is TrackReferenceOrPlaceholder & { publication: NonNullable<TrackReferenceOrPlaceholder["publication"]> } {
  return Boolean(ref.publication?.track && !ref.publication.isMuted);
}

/** Browser full screen for the stage, so the share hero can fill the display. */
function useFullScreen(target: React.RefObject<HTMLElement | null>) {
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const sync = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void target.current?.requestFullscreen().catch(() => {});
  };
  return { isFull, toggle };
}

/**
 * Full-screen huddle (§5): screen-share hero, camera tiles, avatar tiles for
 * voice-only people. The stage is a dark object in both themes — it is painted
 * with the rail and white-alpha chrome rather than a forced `dark` class, so
 * --danger and the rest keep the viewer's own theme values.
 */
export function HuddleStage({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const participants = useParticipants();
  const state = useConnectionState();
  const cameras = useTracks([Track.Source.Camera], { onlySubscribed: false }).filter(hasTrack);
  const shares = useTracks([Track.Source.ScreenShare], { onlySubscribed: false }).filter(hasTrack);
  const share = shares[0];
  const withCamera = new Map(cameras.map((t) => [t.participant.identity, t]));
  const elapsed = useHuddleTimer();
  const { isMicrophoneEnabled } = useLocalParticipant();
  const root = useRef<HTMLDivElement>(null);
  const { isFull, toggle: toggleFullScreen } = useFullScreen(root);

  const count = participants.length;
  const subline =
    state === ConnectionState.Connected
      ? `${elapsed} · ${count} ${count === 1 ? "person" : "people"}${cameras.length > 0 ? " · cameras on" : ""}`
      : state === ConnectionState.Reconnecting
        ? "Reconnecting…"
        : "Connecting…";

  // Your own camera gets the self-preview strip under the grid, as in the design,
  // so the grid stays other people. Alone, you stay in the grid.
  const selfCamera = cameras.find((t) => t.participant.isLocal);
  const selfStrip = Boolean(selfCamera) && count > 1;
  const tiled = selfStrip ? participants.filter((p) => !p.isLocal) : participants;

  return (
    <div ref={root} className="flex h-full min-h-0 flex-col bg-rail">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        {share ? (
          <span className="grid size-[26px] shrink-0 place-items-center rounded-md border border-accent-border bg-primary text-white">
            <MonitorUp className="size-3.5" aria-hidden="true" />
          </span>
        ) : (
          <span className="block size-[7px] shrink-0 rounded-full bg-presence" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <h1 className="block truncate text-[14.5px] font-semibold tracking-[-0.015em] text-white">
            {share ? `${share.participant.name || "Someone"} is sharing a screen` : `Huddle · ${session.label}`}
          </h1>
          <span className="block truncate text-[12px] tabular-nums text-white/55">{share ? `Huddle · ${session.label} · ${elapsed}` : subline}</span>
        </span>
        {share && (
          <button
            type="button"
            onClick={toggleFullScreen}
            className="flex h-8 shrink-0 items-center rounded-md border border-white/16 bg-white/[0.06] px-[11px] text-[12.5px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            {isFull ? "Exit full screen" : "Full screen"}
          </button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={session.href}
              aria-label="Minimise to dock"
              className="grid size-8 shrink-0 place-items-center rounded-md border border-white/16 bg-white/[0.06] text-white transition-colors hover:bg-white/10"
            >
              <ChevronDown className="size-[15px]" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to {session.label}</TooltipContent>
        </Tooltip>
      </header>

      {share ? (
        <div className="flex min-h-0 flex-1 gap-3 px-4 pt-[14px]">
          <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            <VideoTrack trackRef={share} className="size-full object-contain" />
            <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/60 px-2 py-1 text-[12px] font-semibold text-white">
              {share.participant.name}&apos;s screen
            </span>
          </div>
          <ul className="flex w-[132px] shrink-0 flex-col gap-2.5 overflow-y-auto" aria-label="Participants">
            {participants.map((p) => {
              const cam = withCamera.get(p.identity);
              return (
                <li key={p.identity}>
                  <ParticipantTile participant={p} layout="overlay" size="md" dense className="h-[76px] w-full">
                    {cam ? <VideoTrack trackRef={cam} className="size-full object-cover" /> : undefined}
                  </ParticipantTile>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 px-4 pt-[14px]" aria-label="Participants">
          {tiled.map((p) => {
            const cam = withCamera.get(p.identity);
            return (
              <li key={p.identity} className="min-h-[160px] min-w-0">
                <ParticipantTile participant={p} layout="overlay" size="lg" radius="2xl" className="size-full">
                  {cam ? <VideoTrack trackRef={cam} className="size-full object-cover" /> : undefined}
                </ParticipantTile>
              </li>
            );
          })}
        </ul>
      )}

      {selfCamera && selfStrip && (
        <div className="flex shrink-0 items-center gap-2.5 px-4 pt-3">
          <div className="relative h-[104px] w-[184px] shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
            <VideoTrack trackRef={selfCamera} className="size-full object-cover" />
            {!isMicrophoneEnabled && (
              <span className="absolute top-[7px] right-[7px] grid size-5 place-items-center rounded-sm bg-black/70 text-white" role="img" aria-label="You, muted">
                <MicOff className="size-[11px]" aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-white/55 text-pretty">
            {isMicrophoneEnabled ? "Your camera is on — everyone in the huddle can see you." : "You’re muted. People can see your camera, but they can’t hear you."}
          </p>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-center px-4 py-[14px]">
        <HuddleControls tone="dark" onLeave={onLeave} />
      </div>
    </div>
  );
}

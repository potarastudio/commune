"use client";

import { VideoTrack, useConnectionState, useParticipants, useTracks, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Headphones } from "lucide-react";
import Link from "next/link";
import type { HuddleSession } from "@/lib/store/huddle";
import { HuddleControls } from "./huddle-controls";
import { ParticipantBubble } from "./participant-bubble";

function hasTrack(ref: TrackReferenceOrPlaceholder): ref is TrackReferenceOrPlaceholder & { publication: NonNullable<TrackReferenceOrPlaceholder["publication"]> } {
  return Boolean(ref.publication?.track && !ref.publication.isMuted);
}

/** Full-screen huddle (§5): screen share hero, camera tiles, avatar bubbles for voice-only people. */
export function HuddleStage({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const participants = useParticipants();
  const state = useConnectionState();
  const cameras = useTracks([Track.Source.Camera], { onlySubscribed: false }).filter(hasTrack);
  const shares = useTracks([Track.Source.ScreenShare], { onlySubscribed: false }).filter(hasTrack);
  const share = shares[0];
  const withCamera = new Set(cameras.map((t) => t.participant.identity));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground">
          <Headphones className="size-4" aria-hidden="true" />
        </span>
        <h1 className="text-[15px] font-semibold tracking-tight">Huddle in {session.label}</h1>
        <span className="text-[12px] text-sidebar-muted">
          {state === ConnectionState.Connected ? `${participants.length} ${participants.length === 1 ? "person" : "people"}` : "Connecting…"}
        </span>
        <Link href={session.href} className="ml-auto text-[12px] text-sidebar-muted underline-offset-2 hover:text-sidebar-foreground hover:underline">
          Back to {session.label}
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        {share && (
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-sidebar-border bg-black">
            <VideoTrack trackRef={share} className="size-full object-contain" />
            <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[12px] text-white">{share.participant.name}&apos;s screen</span>
          </div>
        )}

        <div className={share ? "flex shrink-0 gap-3 overflow-x-auto" : "grid flex-1 auto-rows-fr grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3"}>
          {cameras.map((t) => (
            <div key={t.participant.identity + t.source} className={`relative overflow-hidden rounded-xl border border-sidebar-border bg-black ${share ? "h-28 w-44 shrink-0" : "min-h-40"}`}>
              <VideoTrack trackRef={t} className="size-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[12px] text-white">{t.participant.name}</span>
            </div>
          ))}
          {participants
            .filter((p) => !withCamera.has(p.identity))
            .map((p) => (
              <div key={p.identity} className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-sidebar-border bg-white/[0.03] ${share ? "h-28 w-44 shrink-0" : "min-h-40"}`}>
                <ParticipantBubble participant={p} size={share ? "md" : "lg"} />
                <span className="text-[13px] font-medium">{p.name}</span>
              </div>
            ))}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-center border-t border-sidebar-border px-5 py-4">
        <div className="rounded-full bg-popover px-3 py-2 text-popover-foreground shadow-md">
          <HuddleControls onLeave={onLeave} collapseHref={session.href} />
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useConnectionState, useParticipants, useTracks } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Maximize2, MessageSquareText, MonitorUp } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HuddleSession } from "@/lib/store/huddle";
import { HuddleControls, useHuddleTimer } from "./huddle-controls";
import { ParticipantTile } from "./participant-bubble";

/**
 * Docked mini-view (§5): a dark floating object beside the rail so you can keep
 * chatting. It stays dark in both themes — the chrome is the rail plus
 * white-alpha, never a forced theme class.
 */
export function HuddleDock({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const participants = useParticipants();
  const state = useConnectionState();
  const shares = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const elapsed = useHuddleTimer();
  const connected = state === ConnectionState.Connected;
  const status = connected
    ? `${elapsed} · ${participants.length} ${participants.length === 1 ? "person" : "people"}`
    : state === ConnectionState.Reconnecting
      ? "Reconnecting…"
      : "Connecting…";

  return (
    <aside
      className="fixed bottom-4 left-[76px] z-40 w-[344px] overflow-hidden rounded-2xl border border-white/12 bg-rail shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]"
      aria-label={`Huddle in ${session.label}`}
    >
      <div className="flex items-center gap-[9px] border-b border-white/10 py-3 pr-2.5 pl-[14px]">
        <span className={`block size-[7px] shrink-0 rounded-full ${connected ? "bg-presence" : "bg-white/40"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">Huddle · {session.label}</span>
          <span className="mt-px block truncate text-[11.5px] tabular-nums text-white/55">{status}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/huddle/${session.huddleId}`}
              aria-label="Expand huddle"
              className="grid size-[30px] shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Maximize2 className="size-4" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Expand</TooltipContent>
        </Tooltip>
      </div>

      <ul className="grid grid-cols-3 gap-2 p-[14px]" aria-label="Participants">
        {participants.map((p) => (
          <li key={p.identity} className="min-w-0">
            <ParticipantTile participant={p} size="lg" />
          </li>
        ))}
      </ul>

      {shares.length > 0 && (
        <p className="-mt-1 flex items-center gap-1.5 px-[14px] pb-2.5 text-[11.5px] text-white/55">
          <MonitorUp className="size-3 shrink-0" aria-hidden="true" />
          A screen is being shared. Expand to watch.
        </p>
      )}

      <div className="px-[14px] pb-3">
        <HuddleControls tone="dark" onLeave={onLeave} />
      </div>

      <Link
        href={session.href}
        className="flex w-full items-center gap-2 border-t border-white/10 bg-white/[0.03] px-[14px] py-[11px] text-left text-[12.5px] font-semibold text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <MessageSquareText className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Take a note in {session.label}</span>
      </Link>
    </aside>
  );
}

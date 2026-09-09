"use client";

import { useConnectionState, useParticipants, useTracks } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Headphones } from "lucide-react";
import type { HuddleSession } from "@/lib/store/huddle";
import { HuddleControls } from "./huddle-controls";
import { ParticipantBubble } from "./participant-bubble";

/** Docked mini-view (§5): bottom-left over the sidebar so you can keep chatting. */
export function HuddleDock({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const participants = useParticipants();
  const state = useConnectionState();
  const shares = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });

  return (
    <aside
      className="fixed bottom-16 left-3 z-40 w-[236px] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
      aria-label={`Huddle in ${session.label}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-accent text-accent-foreground">
          <Headphones className="size-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{session.label}</span>
        <span className="text-[11px] text-muted-foreground">
          {state === ConnectionState.Connected ? `${participants.length} in` : state === ConnectionState.Reconnecting ? "Reconnecting…" : "Connecting…"}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Participants">
        {participants.map((p) => (
          <li key={p.identity}>
            <ParticipantBubble participant={p} size="sm" />
          </li>
        ))}
      </ul>
      {shares.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Screen is being shared. Expand to watch.</p>}

      <div className="mt-3">
        <HuddleControls onLeave={onLeave} expandHref={`/huddle/${session.huddleId}`} />
      </div>
    </aside>
  );
}

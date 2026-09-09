"use client";

import { useIsMuted, useIsSpeaking } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function avatarFromMetadata(p: Participant): string | null {
  try {
    return p.metadata ? ((JSON.parse(p.metadata) as { avatar_url?: string | null }).avatar_url ?? null) : null;
  } catch {
    return null;
  }
}

type Size = "sm" | "md" | "lg";
const AVATAR: Record<Size, string> = { sm: "size-[26px]", md: "size-9", lg: "size-[46px]" };
const AVATAR_TEXT: Record<Size, string> = { sm: "text-[11px]", md: "text-[14px]", lg: "text-[18px]" };

/** Tile corner: 12px for the dock and the 76px share rail, 14px for the big camera tiles. */
type Radius = "xl" | "2xl";
const RADIUS: Record<Radius, string> = { xl: "rounded-xl", "2xl": "rounded-2xl" };
const IDLE_RING: Record<Radius, string> = {
  xl: "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
  "2xl": "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
};
const SPEAKING_RING: Record<Radius, string> = {
  xl: "shadow-[inset_0_0_0_2px_var(--presence)]",
  "2xl": "shadow-[inset_0_0_0_2.5px_var(--presence)]",
};

/**
 * Avatar for one person in a huddle. On its own it carries the speaking ring
 * and the muted badge; inside a tile pass `plain` so the tile owns both.
 */
export function ParticipantBubble({ participant, size = "md", plain = false }: { participant: Participant; size?: Size; plain?: boolean }) {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ source: Track.Source.Microphone, participant });
  const name = participant.name || "Someone";

  const avatar = (
    <Avatar className={`${AVATAR[size]} rounded-full bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]`}>
      <AvatarImage src={avatarFromMetadata(participant) ?? undefined} alt="" className="object-cover" />
      <AvatarFallback className={`rounded-full bg-bg-avatar font-semibold text-fg-600 ${AVATAR_TEXT[size]}`}>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );

  if (plain) return avatar;

  return (
    <span className="relative inline-block" title={name}>
      <span
        className={`block rounded-full transition-shadow ${speaking ? "shadow-[0_0_0_2px_var(--presence)]" : "shadow-[0_0_0_2px_transparent]"}`}
        aria-label={`${name}${speaking ? ", speaking" : ""}${muted ? ", muted" : ""}`}
        role="img"
      >
        {avatar}
      </span>
      {muted && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-[15px] place-items-center rounded-full border-2 border-bg-card bg-danger-surface text-danger" aria-hidden="true">
          <MicOff className="size-2" />
        </span>
      )}
    </span>
  );
}

/**
 * The designed participant tile: a dark surface with a presence ring while the
 * person is speaking. Tiles only ever sit on huddle chrome (the stage and the
 * floating dock), so the ground and rings are white-alpha rather than themed.
 * `overlay` puts the name badge over video, `stacked` sits it under a centred
 * avatar (the dock and voice-only tiles).
 */
export function ParticipantTile({
  participant,
  layout = "stacked",
  size = "lg",
  dense = false,
  radius = "xl",
  className = "",
  children,
}: {
  participant: Participant;
  layout?: "overlay" | "stacked";
  size?: Size;
  dense?: boolean;
  radius?: Radius;
  className?: string;
  children?: React.ReactNode;
}) {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ source: Track.Source.Microphone, participant });
  const name = participant.name || "Someone";
  const ring = speaking ? SPEAKING_RING[radius] : IDLE_RING[radius];
  const MicIcon = muted ? MicOff : Mic;
  const micTone = muted ? "text-white" : "text-presence";
  const iconSize = dense ? "size-[11px]" : "size-3";

  if (layout === "overlay") {
    return (
      <div
        className={`relative overflow-hidden ${RADIUS[radius]} bg-white/5 ${ring} ${className}`}
        aria-label={`${name}${muted ? ", muted" : ""}`}
        role="group"
      >
        {children ?? (
          <span className="grid size-full place-items-center p-3">
            <ParticipantBubble participant={participant} size={size} plain />
          </span>
        )}
        <span
          className={`absolute bottom-2 left-2 flex max-w-[calc(100%-16px)] items-center gap-[5px] rounded-md bg-black/60 font-semibold text-white ${
            dense ? "px-1.5 py-[3px] text-[11px]" : "px-2 py-1 text-[12px]"
          }`}
        >
          <MicIcon className={`${iconSize} shrink-0 ${micTone}`} aria-hidden="true" />
          <span className="truncate">{name}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center gap-2 ${RADIUS[radius]} bg-white/5 px-2.5 pt-4 pb-3 ${ring} ${className}`}
      aria-label={`${name}${muted ? ", muted" : ""}`}
      role="group"
    >
      <ParticipantBubble participant={participant} size={size} plain />
      <span className="flex max-w-full items-center gap-[5px] text-[12px] font-semibold text-white">
        <MicIcon className={`${iconSize} shrink-0 ${micTone}`} aria-hidden="true" />
        <span className="truncate">{name}</span>
      </span>
    </div>
  );
}

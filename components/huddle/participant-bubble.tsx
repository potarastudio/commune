"use client";

import { useIsMuted, useIsSpeaking } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { MicOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function avatarFromMetadata(p: Participant): string | null {
  try {
    return p.metadata ? ((JSON.parse(p.metadata) as { avatar_url?: string | null }).avatar_url ?? null) : null;
  } catch {
    return null;
  }
}

/** Avatar with a speaking ring and a muted badge. */
export function ParticipantBubble({ participant, size = "md" }: { participant: Participant; size?: "sm" | "md" | "lg" }) {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ source: Track.Source.Microphone, participant });
  const name = participant.name || "Someone";
  const px = size === "sm" ? "size-8" : size === "md" ? "size-12" : "size-20";
  const text = size === "sm" ? "text-[12px]" : size === "md" ? "text-[16px]" : "text-[26px]";

  return (
    <span className="relative inline-block" title={name}>
      <span
        className={`block rounded-full transition-shadow ${speaking ? "shadow-[0_0_0_3px_var(--online)]" : "shadow-[0_0_0_3px_transparent]"}`}
        aria-label={`${name}${speaking ? ", speaking" : ""}${muted ? ", muted" : ""}`}
        role="img"
      >
        <Avatar className={`${px} rounded-full`}>
          <AvatarImage src={avatarFromMetadata(participant) ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className={`rounded-full bg-accent font-semibold text-accent-foreground ${text}`}>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </span>
      {muted && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full border-2 border-background bg-foreground text-background" aria-hidden="true">
          <MicOff className="size-2.5" />
        </span>
      )}
    </span>
  );
}

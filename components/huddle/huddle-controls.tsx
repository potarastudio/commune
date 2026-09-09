"use client";

import { useLocalParticipant, useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function ControlButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={`grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            danger
              ? "bg-destructive text-destructive-foreground hover:opacity-90"
              : active
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-border"
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Mic, camera, screen share, expand/collapse, leave. Shared by the dock and the stage. */
export function HuddleControls({ onLeave, expandHref, collapseHref }: { onLeave: () => void; expandHref?: string; collapseHref?: string }) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });
  const { localParticipant } = useLocalParticipant();
  const micOn = mic.enabled;
  const camOn = cam.enabled;
  const sharing = screen.enabled;

  return (
    <div className="flex items-center gap-1.5" role="toolbar" aria-label="Huddle controls">
      <ControlButton label={micOn ? "Mute" : "Unmute"} active={!micOn} onClick={() => void mic.toggle()}>
        {micOn ? <Mic className="size-4" aria-hidden="true" /> : <MicOff className="size-4" aria-hidden="true" />}
      </ControlButton>
      <ControlButton label={camOn ? "Turn camera off" : "Turn camera on"} active={camOn} onClick={() => void cam.toggle()}>
        {camOn ? <Video className="size-4" aria-hidden="true" /> : <VideoOff className="size-4" aria-hidden="true" />}
      </ControlButton>
      <ControlButton label={sharing ? "Stop sharing" : "Share screen"} active={sharing} onClick={() => void screen.toggle()}>
        <MonitorUp className="size-4" aria-hidden="true" />
      </ControlButton>
      {expandHref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={expandHref} aria-label="Expand huddle" className="grid size-9 place-items-center rounded-full bg-muted text-foreground hover:bg-border focus-visible:outline-2 focus-visible:outline-ring">
              <Maximize2 className="size-4" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Expand</TooltipContent>
        </Tooltip>
      )}
      {collapseHref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={collapseHref} aria-label="Back to chat" className="grid size-9 place-items-center rounded-full bg-muted text-foreground hover:bg-border focus-visible:outline-2 focus-visible:outline-ring">
              <Minimize2 className="size-4" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Back to chat</TooltipContent>
        </Tooltip>
      )}
      <ControlButton label="Leave huddle" danger onClick={onLeave}>
        <PhoneOff className="size-4" aria-hidden="true" />
      </ControlButton>
      <span className="sr-only">{localParticipant.name}</span>
    </div>
  );
}

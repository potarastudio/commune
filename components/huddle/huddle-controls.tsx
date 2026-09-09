"use client";

import { useLocalParticipant, useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { ChevronDown, Maximize2, Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Two tones for the same controls: `dark` on the huddle chrome — the stage and
 * the floating dock (40px, white-on-black) — and `surface` for a themed
 * in-column dock (34px, card-on-page). The dark tone never relies on the
 * viewer's theme: its chrome is white-alpha over the rail.
 */
export type HuddleTone = "dark" | "surface";

const SHELL: Record<HuddleTone, string> = {
  dark: "grid size-10 place-items-center rounded-xl border transition-colors",
  surface: "grid size-[34px] place-items-center rounded-lg border transition-colors",
};
const IDLE: Record<HuddleTone, string> = {
  dark: "border-white/16 bg-white/[0.06] text-white hover:bg-white/10",
  surface: "border-border-strong bg-bg-card text-fg-400 hover:bg-bg-card-hover hover:text-ink",
};
const ENGAGED: Record<HuddleTone, string> = {
  dark: "border-white/90 bg-white text-rail hover:bg-white/90",
  surface: "border-accent-border bg-primary text-white hover:bg-primary-hover",
};
const DANGER: Record<HuddleTone, string> = {
  dark: "border-danger bg-danger/15 text-white hover:bg-danger/25",
  surface: "border-danger bg-danger-surface text-danger hover:brightness-[0.98]",
};
const ICON: Record<HuddleTone, string> = { dark: "size-[18px]", surface: "size-4" };
const LEAVE: Record<HuddleTone, string> = {
  dark: "flex h-10 shrink-0 items-center gap-2 rounded-xl border border-danger bg-danger px-4 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-[filter] hover:brightness-110",
  surface:
    "flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-danger bg-danger px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[filter] hover:brightness-110",
};

/** mm:ss since this browser joined, for the dock and stage headers. */
export function useHuddleTimer(): string {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function ControlButton({
  label,
  tone,
  state = "idle",
  onClick,
  children,
}: {
  label: string;
  tone: HuddleTone;
  state?: "idle" | "engaged" | "danger";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const look = state === "danger" ? DANGER[tone] : state === "engaged" ? ENGAGED[tone] : IDLE[tone];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} aria-pressed={state !== "idle"} className={`${SHELL[tone]} ${look}`}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Mic, camera, screen share, expand/collapse, leave. Shared by the dock and the stage. */
export function HuddleControls({
  onLeave,
  expandHref,
  collapseHref,
  tone = "dark",
}: {
  onLeave: () => void;
  expandHref?: string;
  collapseHref?: string;
  tone?: HuddleTone;
}) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });
  const { localParticipant } = useLocalParticipant();
  const micOn = mic.enabled;
  const camOn = cam.enabled;
  const sharing = screen.enabled;
  const icon = ICON[tone];

  return (
    <div className="flex items-center gap-[7px]" role="toolbar" aria-label="Huddle controls">
      <ControlButton label={micOn ? "Mute" : "Unmute"} tone={tone} state={micOn ? "idle" : "danger"} onClick={() => void mic.toggle()}>
        {micOn ? <Mic className={icon} aria-hidden="true" /> : <MicOff className={icon} aria-hidden="true" />}
      </ControlButton>
      <ControlButton label={camOn ? "Turn camera off" : "Turn camera on"} tone={tone} state={camOn ? "engaged" : "idle"} onClick={() => void cam.toggle()}>
        {camOn ? <Video className={icon} aria-hidden="true" /> : <VideoOff className={icon} aria-hidden="true" />}
      </ControlButton>
      <ControlButton label={sharing ? "Stop sharing" : "Share screen"} tone={tone} state={sharing ? "engaged" : "idle"} onClick={() => void screen.toggle()}>
        <MonitorUp className={icon} aria-hidden="true" />
      </ControlButton>
      {expandHref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={expandHref} aria-label="Expand huddle" className={`${SHELL[tone]} ${IDLE[tone]}`}>
              <Maximize2 className={icon} aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Expand</TooltipContent>
        </Tooltip>
      )}
      {collapseHref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={collapseHref} aria-label="Back to chat" className={`${SHELL[tone]} ${IDLE[tone]}`}>
              <ChevronDown className={icon} aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Back to chat</TooltipContent>
        </Tooltip>
      )}
      {tone === "dark" && <span className="mx-1 block h-[26px] w-px shrink-0 bg-white/16" aria-hidden="true" />}
      <button type="button" aria-label="Leave huddle" onClick={onLeave} className={`ml-auto ${LEAVE[tone]}`}>
        Leave
      </button>
      <span className="sr-only">{localParticipant.name}</span>
    </div>
  );
}

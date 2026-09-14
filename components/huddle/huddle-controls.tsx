"use client";

import { useLocalParticipant, useTrackToggle } from "@livekit/components-react";
import { MediaDeviceFailure, Track, type ScreenShareCaptureOptions } from "livekit-client";
import { ChevronDown, ChevronUp, Maximize2, Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { humanError } from "@/lib/utils/human-error";
import { AudioSettingsMenu, MENU_SURFACE, VideoSettingsMenu } from "./device-menu";

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

/**
 * A control with a settings arrow attached: one bordered object in the
 * control's state, split by a hairline. Each half takes its own hover and an
 * inset focus ring, since the group clips its corners.
 */
const GROUP: Record<HuddleTone, string> = {
  dark: "flex h-10 shrink-0 overflow-hidden rounded-xl border transition-colors",
  surface: "flex h-[34px] shrink-0 overflow-hidden rounded-lg border transition-colors",
};
const GROUP_LOOK: Record<HuddleTone, Record<"idle" | "engaged" | "danger", { group: string; half: string; open: string; rule: string }>> = {
  dark: {
    idle: { group: "border-white/16 bg-white/[0.06] text-white", half: "hover:bg-white/[0.06]", open: "data-[state=open]:bg-white/10", rule: "bg-white/12" },
    engaged: { group: "border-white/90 bg-white text-rail", half: "hover:bg-black/[0.06]", open: "data-[state=open]:bg-black/[0.08]", rule: "bg-black/10" },
    danger: { group: "border-danger bg-danger/15 text-white", half: "hover:bg-danger/15", open: "data-[state=open]:bg-danger/20", rule: "bg-danger/40" },
  },
  surface: {
    idle: { group: "border-border-strong bg-bg-card text-fg-400", half: "hover:bg-bg-card-hover hover:text-ink", open: "data-[state=open]:bg-bg-card-hover", rule: "bg-border-strong" },
    engaged: { group: "border-accent-border bg-primary text-white", half: "hover:bg-primary-hover", open: "data-[state=open]:bg-primary-hover", rule: "bg-white/25" },
    danger: { group: "border-danger bg-danger-surface text-danger", half: "hover:brightness-[0.98]", open: "data-[state=open]:brightness-[0.97]", rule: "bg-danger/30" },
  },
};
const MAIN_HALF: Record<HuddleTone, string> = { dark: "w-[39px]", surface: "w-[33px]" };
const ARROW_HALF: Record<HuddleTone, string> = { dark: "w-[22px]", surface: "w-5" };
/** Border, main half and hairline: how far the arrow sits from the group's left edge, so its menu can line up with the whole control. */
const ARROW_INSET: Record<HuddleTone, number> = { dark: 41, surface: 35 };

/**
 * Screen share asks for more than the browser's default picker offers. In
 * Chromium browsers this adds tabs with their sound, and system sound where
 * the OS allows it; it leaves Commune's own tab out, since sharing it only
 * mirrors the huddle back at everyone. The desktop app ignores these and
 * shows its own picker.
 */
const SCREEN_SHARE_OPTIONS: ScreenShareCaptureOptions = {
  audio: true,
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  systemAudio: "include",
};

type ToggleKind = "microphone" | "camera" | "screen";

const FAILURE_COPY: Record<Exclude<ToggleKind, "screen">, Record<"blocked" | "missing" | "busy" | "other", [string, string]>> = {
  microphone: {
    blocked: ["Microphone blocked", "Allow microphone access, then try again."],
    missing: ["No microphone found", "Plug one in, then try again."],
    busy: ["Microphone in use", "Another app is using it. Close that app, then try again."],
    other: ["Couldn't turn on your microphone", ""],
  },
  camera: {
    blocked: ["Camera blocked", "Allow camera access, then try again."],
    missing: ["No camera found", "Plug one in, then try again."],
    busy: ["Camera in use", "Another app is using it. Close that app, then try again."],
    other: ["Couldn't turn on your camera", ""],
  },
};

/**
 * Turning a mic, camera or share on can fail, and LiveKit rethrows unless
 * given a handler, which left an uncaught rejection behind every cancelled
 * share. Closing the share picker is someone changing their mind, so it stays
 * silent; everything else gets a toast that says what to do.
 */
function toggleFailed(kind: ToggleKind) {
  return (err: Error) => {
    const failure = MediaDeviceFailure.getFailure(err);
    if (kind === "screen") {
      // Closing a browser's picker is a NotAllowedError; the desktop app's refusal
      // arrives as an AbortError, because Electron has no way to say "denied".
      if (err.name === "AbortError") return;
      if (failure === MediaDeviceFailure.PermissionDenied && !/system/i.test(err.message)) return;
      if (failure === MediaDeviceFailure.PermissionDenied) {
        toast.error("Screen sharing blocked", { description: "Allow screen recording in System Settings, then try again." });
      } else {
        toast.error("Couldn't share your screen", { description: humanError(err) });
      }
      return;
    }
    const key =
      failure === MediaDeviceFailure.PermissionDenied
        ? "blocked"
        : failure === MediaDeviceFailure.NotFound
          ? "missing"
          : failure === MediaDeviceFailure.DeviceInUse
            ? "busy"
            : "other";
    const [title, description] = FAILURE_COPY[kind][key];
    toast.error(title, { description: description || humanError(err) });
  };
}

const MIC_FAILED = toggleFailed("microphone");
const CAMERA_FAILED = toggleFailed("camera");
const SHARE_FAILED = toggleFailed("screen");

const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

/** The element in full screen, if any. Menus and tooltips portal into it, or they would open out of sight. */
function useFullscreenElement(): HTMLElement | null {
  return useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement as HTMLElement | null,
    () => null,
  );
}
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
  container,
  children,
}: {
  label: string;
  tone: HuddleTone;
  state?: "idle" | "engaged" | "danger";
  onClick?: () => void;
  container: HTMLElement | null;
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
      <TooltipContent side="top" container={container}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** A toggle with its settings menu on an attached arrow: the mic and the camera. */
function SplitControl({
  label,
  menuLabel,
  tone,
  state,
  onClick,
  container,
  menu,
  children,
}: {
  label: string;
  menuLabel: string;
  tone: HuddleTone;
  state: "idle" | "engaged" | "danger";
  onClick: () => void;
  container: HTMLElement | null;
  menu: React.ReactNode;
  children: React.ReactNode;
}) {
  const look = GROUP_LOOK[tone][state];
  const half = `grid h-full place-items-center transition-colors focus-visible:outline-offset-[-3px] ${look.half}`;
  return (
    <div className={`${GROUP[tone]} ${look.group}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onClick} aria-label={label} aria-pressed={state !== "idle"} className={`${half} ${MAIN_HALF[tone]}`}>
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" container={container}>
          {label}
        </TooltipContent>
      </Tooltip>
      <span className={`my-2 w-px shrink-0 ${look.rule}`} aria-hidden="true" />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={menuLabel} className={`${half} ${ARROW_HALF[tone]} ${look.open}`}>
                <ChevronUp className="size-3.5 opacity-75" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" container={container}>
            {menuLabel}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="top"
          align="start"
          alignOffset={-ARROW_INSET[tone]}
          sideOffset={8}
          container={container}
          className={MENU_SURFACE[tone]}
        >
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const mic = useTrackToggle({ source: Track.Source.Microphone, onDeviceError: MIC_FAILED });
  const cam = useTrackToggle({ source: Track.Source.Camera, onDeviceError: CAMERA_FAILED });
  const screen = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: SCREEN_SHARE_OPTIONS,
    onDeviceError: SHARE_FAILED,
  });
  const { localParticipant } = useLocalParticipant();
  const container = useFullscreenElement();
  const micOn = mic.enabled;
  const camOn = cam.enabled;
  const sharing = screen.enabled;
  const icon = ICON[tone];

  return (
    <div className="flex items-center gap-[7px]" role="toolbar" aria-label="Huddle controls">
      <SplitControl
        label={micOn ? "Mute" : "Unmute"}
        menuLabel="Audio settings"
        tone={tone}
        state={micOn ? "idle" : "danger"}
        onClick={() => void mic.toggle()}
        container={container}
        menu={<AudioSettingsMenu tone={tone} />}
      >
        {micOn ? <Mic className={icon} aria-hidden="true" /> : <MicOff className={icon} aria-hidden="true" />}
      </SplitControl>
      <SplitControl
        label={camOn ? "Turn camera off" : "Turn camera on"}
        menuLabel="Video settings"
        tone={tone}
        state={camOn ? "engaged" : "idle"}
        onClick={() => void cam.toggle()}
        container={container}
        menu={<VideoSettingsMenu tone={tone} />}
      >
        {camOn ? <Video className={icon} aria-hidden="true" /> : <VideoOff className={icon} aria-hidden="true" />}
      </SplitControl>
      <ControlButton
        label={sharing ? "Stop sharing" : "Share screen"}
        tone={tone}
        state={sharing ? "engaged" : "idle"}
        onClick={() => void screen.toggle()}
        container={container}
      >
        <MonitorUp className={icon} aria-hidden="true" />
      </ControlButton>
      {expandHref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={expandHref} aria-label="Expand huddle" className={`${SHELL[tone]} ${IDLE[tone]}`}>
              <Maximize2 className={icon} aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top" container={container}>
            Expand
          </TooltipContent>
        </Tooltip>
      )}
      {collapseHref && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={collapseHref} aria-label="Back to chat" className={`${SHELL[tone]} ${IDLE[tone]}`}>
              <ChevronDown className={icon} aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top" container={container}>
            Back to chat
          </TooltipContent>
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

"use client";

import {
  VideoTrack,
  useConnectionState,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useSpeakingParticipants,
  useTrackToggle,
  useTracks,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionState, Track, type Participant } from "livekit-client";
import { ChevronDown, Mic, MicOff, MonitorUp, PhoneOff, Plus, Video, VideoOff } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useHuddleTimer } from "@/components/huddle/huddle-controls";
import { avatarFromMetadata } from "@/components/huddle/participant-bubble";
import type { HuddleSession } from "@/lib/store/huddle";
import { cn } from "@/lib/utils";
import { useHuddleBarHost } from "./huddle-bar-slot";
import { useMobileNav } from "./use-mobile-nav";

function hasTrack(ref: TrackReferenceOrPlaceholder): ref is TrackReferenceOrPlaceholder & { publication: NonNullable<TrackReferenceOrPlaceholder["publication"]> } {
  return Boolean(ref.publication?.track && !ref.publication.isMuted);
}

/** "#design" drawn with the hash dimmed, as every huddle header does. */
function Place({ label }: { label: string }) {
  return label.startsWith("#") ? (
    <>
      <span className="text-white/50">#</span>
      {label.slice(1)}
    </>
  ) : (
    <>{label}</>
  );
}

function SpeakingBars({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("speaking-bars flex h-[13px] items-end gap-[2px]", className)}>
      <span className="block h-[6px] w-[3px] rounded-full bg-primary" />
      <span className="block h-[11px] w-[3px] rounded-full bg-primary" />
      <span className="block h-[8px] w-[3px] rounded-full bg-primary" />
    </span>
  );
}

// ---- The minimised bar ------------------------------------------------------------

/**
 * The huddle, minimised (design: Mobile Huddle → Minimised): a dark bar under
 * the header naming whoever is talking, with Mute and Leave in reach — the two
 * you need in a hurry. Tapping the rest of it opens the huddle.
 */
export function MobileHuddleBar({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const host = useHuddleBarHost();
  const nav = useMobileNav();
  const participants = useParticipants();
  const speakers = useSpeakingParticipants();
  const state = useConnectionState();
  const elapsed = useHuddleTimer();
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  if (!host) return null;

  const speaker = speakers.find((p) => !p.isLocal) ?? speakers[0];
  const title =
    state === ConnectionState.Reconnecting
      ? "Reconnecting…"
      : state !== ConnectionState.Connected
        ? "Connecting…"
        : speaker
          ? `${speaker.isLocal ? "You are" : `${speaker.name || "Someone"} is`} speaking`
          : `Huddle in ${session.label}`;

  return createPortal(
    <div className="shrink-0 bg-bg-main px-[12px] pt-[8px]">
      <div className="flex items-center gap-[11px] rounded-[14px] bg-rail py-[9px] pr-[9px] pl-[13px]">
        <button
          type="button"
          onClick={() => nav.push(`/huddle/${session.huddleId}`)}
          className="flex min-w-0 flex-1 items-center gap-[11px] text-left"
          aria-label={`Open the huddle in ${session.label}`}
        >
          {speaker ? <SpeakingBars className="h-[15px] shrink-0" /> : <span aria-hidden="true" className="block size-[8px] shrink-0 rounded-full bg-presence" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white">{title}</span>
            <span className="mt-px block truncate text-[11.5px] text-white/55 tabular-nums">
              {session.label} · {participants.length} {participants.length === 1 ? "person" : "people"} · {elapsed}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={mic.enabled ? "Mute" : "Unmute"}
          aria-pressed={!mic.enabled}
          onClick={() => void mic.toggle()}
          className={cn(
            "grid size-[44px] shrink-0 place-items-center rounded-[11px]",
            mic.enabled ? "bg-white/10 text-white" : "bg-white text-[#171717]",
          )}
        >
          {mic.enabled ? <Mic className="size-[19px]" aria-hidden="true" /> : <MicOff className="size-[19px]" aria-hidden="true" />}
        </button>
        <button type="button" aria-label="Leave huddle" onClick={onLeave} className="grid size-[44px] shrink-0 place-items-center rounded-[11px] bg-danger text-white">
          <PhoneOff className="size-[19px]" aria-hidden="true" />
        </button>
      </div>
    </div>,
    host,
  );
}

// ---- The full-screen huddle ---------------------------------------------------------

/** One person: a square tile with their face, their name and mic, and an accent edge while they talk. */
function Tile({ participant, camera }: { participant: Participant; camera?: TrackReference }) {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ source: Track.Source.Microphone, participant });
  const name = participant.isLocal ? "You" : participant.name || "Someone";
  const avatar = avatarFromMetadata(participant);
  return (
    <li
      className={cn(
        "relative flex aspect-square min-w-0 flex-col items-center justify-center gap-[9px] overflow-hidden rounded-[16px] border px-[10px] py-[18px] transition-colors",
        speaking ? "border-primary bg-primary/12" : "border-white/10 bg-white/5",
      )}
      aria-label={`${name}${speaking ? ", speaking" : ""}${muted ? ", muted" : ""}`}
    >
      {camera ? (
        <VideoTrack trackRef={camera} className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="grid size-[62px] shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatars come from storage and Google, sized by CSS
            <img src={avatar} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-[22px] font-semibold text-white/80">{name.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
      )}
      <span
        className={cn(
          "flex max-w-full items-center gap-[5px] text-[12.5px] font-semibold text-white",
          camera && "absolute bottom-[8px] left-[8px] max-w-[calc(100%-16px)] rounded-[7px] bg-black/60 px-[7px] py-[3px]",
        )}
      >
        {muted && <MicOff className="size-[12px] shrink-0 text-white/60" aria-hidden="true" />}
        <span className="truncate">{name}</span>
      </span>
      {speaking && <SpeakingBars className="absolute top-[9px] right-[9px]" />}
    </li>
  );
}

/** A 56px round control on the huddle's dark ground. */
function RoundControl({
  label,
  pressed,
  tone = "idle",
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  tone?: "idle" | "inverse" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "grid size-[56px] shrink-0 place-items-center rounded-full border [&>svg]:size-[22px]",
        tone === "inverse" && "border-white bg-white text-[#171717]",
        tone === "idle" && "border-white/14 bg-white/10 text-white active:bg-white/16",
        tone === "danger" && "border-danger bg-danger text-white",
      )}
    >
      {children}
    </button>
  );
}

/**
 * In a huddle, on the phone (design: Mobile Huddle → Active, Screen share,
 * Video). Audio-first: square tiles two to a row, the speaking ring on the
 * accent, and Invite as the last tile rather than a buried menu item. A shared
 * screen takes the room and people shrink to a filmstrip; turning video on
 * fills the same tiles, so nothing relayouts.
 */
export function MobileHuddleStage({ session, onLeave }: { session: HuddleSession; onLeave: () => void }) {
  const nav = useMobileNav();
  const participants = useParticipants();
  const state = useConnectionState();
  const elapsed = useHuddleTimer();
  const { localParticipant } = useLocalParticipant();
  const cameras = useTracks([Track.Source.Camera], { onlySubscribed: false }).filter(hasTrack);
  const shares = useTracks([Track.Source.ScreenShare], { onlySubscribed: false }).filter(hasTrack);
  const share = shares[0];
  const withCamera = new Map(cameras.map((t) => [t.participant.identity, t as TrackReference]));
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });
  // WebViews on phones cannot capture the screen; offer it only where the browser can.
  const canShare = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

  const count = participants.length;
  const subline =
    state === ConnectionState.Connected
      ? `${count} ${count === 1 ? "person" : "people"} · ${elapsed}`
      : state === ConnectionState.Reconnecting
        ? "Reconnecting…"
        : "Connecting…";
  // You last, as the design orders the grid.
  const ordered = [...participants.filter((p) => !p.isLocal), ...participants.filter((p) => p.isLocal)];

  const invite = async () => {
    const url = `${window.location.origin}${session.href}`;
    try {
      if (navigator.share) await navigator.share({ title: `Huddle in ${session.label}`, text: `Join the huddle in ${session.label}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied", { description: `Anyone in ${session.label} can join from there.` });
      }
    } catch {
      // The share sheet was dismissed.
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-rail pb-[var(--safe-bottom)]">
      <div className="flex shrink-0 items-center gap-[10px] px-[14px] pt-[16px] pb-[6px]">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-[6px] truncate text-[15px] font-semibold tracking-[-0.015em] text-white">
            {share ? `${share.participant.isLocal ? "You are" : `${share.participant.name || "Someone"} is`} sharing` : <Place label={session.label} />}
          </span>
          <span className="mt-[2px] block text-[12px] text-white/55 tabular-nums">{share ? `${session.label} · ${elapsed}` : subline}</span>
        </span>
        <button
          type="button"
          aria-label="Minimise"
          onClick={nav.closeSurface}
          className="grid size-[44px] shrink-0 place-items-center rounded-[11px] text-white/75 active:bg-white/10"
        >
          <ChevronDown className="size-[21px]" aria-hidden="true" />
        </button>
      </div>

      {share ? (
        <div className="flex min-h-0 flex-1 flex-col gap-[10px] px-[14px] pt-[8px]">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            <VideoTrack trackRef={share} className="size-full object-contain" />
            <span className="absolute bottom-[10px] left-[10px] rounded-[7px] bg-black/60 px-[8px] py-[4px] text-[12px] font-semibold text-white">
              {share.participant.isLocal ? "Your screen" : `${share.participant.name || "Someone"}’s screen`}
            </span>
          </div>
          <ul className="flex shrink-0 gap-[8px] overflow-x-auto pb-[2px] [scrollbar-width:none] [&>li]:w-[92px] [&>li]:shrink-0 [&>li]:py-[10px] [&_img]:size-[40px]" aria-label="Participants">
            {ordered.map((p) => (
              <Tile key={p.identity} participant={p} camera={withCamera.get(p.identity)} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-[14px] pt-[8px]">
          <ul className="grid grid-cols-2 gap-[10px]" aria-label="Participants">
            {ordered.map((p) => (
              <Tile key={p.identity} participant={p} camera={withCamera.get(p.identity)} />
            ))}
            <li className="list-none">
              <button
                type="button"
                onClick={() => void invite()}
                className="flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-[9px] rounded-[16px] border border-dashed border-white/18 px-[10px] py-[18px] active:bg-white/5"
              >
                <span className="grid size-[48px] place-items-center rounded-full bg-white/8 text-white">
                  <Plus className="size-[22px]" aria-hidden="true" />
                </span>
                <span className="text-[12.5px] font-semibold text-white/75">Invite</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-center gap-[11px] px-[14px] pt-[18px] pb-[26px]" role="toolbar" aria-label="Huddle controls">
        <RoundControl label={mic.enabled ? "Mute" : "Unmute"} pressed={!mic.enabled} tone={mic.enabled ? "idle" : "inverse"} onClick={() => void mic.toggle()}>
          {mic.enabled ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
        </RoundControl>
        <RoundControl label={cam.enabled ? "Stop video" : "Start video"} pressed={cam.enabled} tone={cam.enabled ? "inverse" : "idle"} onClick={() => void cam.toggle()}>
          {cam.enabled ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}
        </RoundControl>
        {canShare && (
          <RoundControl label={screen.enabled ? "Stop sharing" : "Share screen"} pressed={screen.enabled} tone={screen.enabled ? "inverse" : "idle"} onClick={() => void screen.toggle()}>
            <MonitorUp aria-hidden="true" />
          </RoundControl>
        )}
        <RoundControl label="Leave huddle" tone="danger" onClick={onLeave}>
          <PhoneOff aria-hidden="true" />
        </RoundControl>
      </div>
      <span className="sr-only">{localParticipant.name}</span>
    </div>
  );
}

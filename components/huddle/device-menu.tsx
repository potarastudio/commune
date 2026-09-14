"use client";

import { useLocalParticipant, useMediaDeviceSelect, useTrackVolume } from "@livekit/components-react";
import type { LocalAudioTrack } from "livekit-client";
import { CheckIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { toast } from "sonner";
import { useHuddleDevices } from "@/lib/store/huddle-devices";
import { canChooseSpeaker, checkedRow, deviceRows, devicesHidden, type MediaKind } from "@/lib/utils/media-devices";
import type { HuddleTone } from "./huddle-controls";

/**
 * The menus behind the arrows on the mic and camera buttons: which
 * microphone, speaker and camera the huddle uses. Picking one switches the
 * live track straight away and is remembered for the next huddle.
 *
 * Mounted only while open. The device lists never ask for a permission
 * themselves (`requestPermissions: false`), so opening a menu can't flash the
 * camera light or raise a browser prompt; a browser that hides names until
 * then gets numbered rows instead.
 */

/** The dark chrome's menu surface and rows. The surface tone keeps the app's themed menu. */
export const MENU_SURFACE: Record<HuddleTone, string> = {
  dark: "w-[288px] border-white/12 bg-[color-mix(in_oklab,var(--rail),white_7%)] text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]",
  surface: "w-[288px]",
};
const ROW: Record<HuddleTone, string> = {
  dark: "text-white/90 focus:bg-white/[0.08] focus:text-white",
  surface: "text-ink focus:bg-bg-subtle",
};
const LABEL: Record<HuddleTone, string> = { dark: "text-white/50", surface: "text-fg-600" };
const MUTED_TEXT: Record<HuddleTone, string> = { dark: "text-white/45", surface: "text-fg-500" };
const RULE: Record<HuddleTone, string> = { dark: "bg-white/10", surface: "bg-border-subtle" };

const NOUN: Record<MediaKind, string> = { audioinput: "microphone", audiooutput: "speaker", videoinput: "camera" };
const HEADING: Record<MediaKind, string> = { audioinput: "Microphone", audiooutput: "Speaker", videoinput: "Camera" };

function DeviceSection({
  kind,
  tone,
  aside,
  optional = false,
}: {
  kind: MediaKind;
  tone: HuddleTone;
  aside?: React.ReactNode;
  /** Leave the section out, rule and all, when the browser lists nothing: Firefox names no speakers. */
  optional?: boolean;
}) {
  const setDevice = useHuddleDevices((s) => s.setDevice);
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: false });
  const rows = deviceRows(devices, kind);
  const checked = checkedRow(rows, activeDeviceId);

  const choose = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    try {
      // Exact, which is LiveKit's default. As a mere preference Chrome kept the
      // microphone it already had open. Unplugging it later is handled by
      // LiveKit, which falls back to the system default.
      await setActiveMediaDevice(id);
      setDevice(kind, { id, label: devices.find((d) => d.kind === kind && d.deviceId === id)?.label ?? "" });
    } catch (err) {
      console.error("huddle device switch", { kind, err });
      toast.error(`Couldn't switch to ${row?.label ?? `that ${NOUN[kind]}`}`, {
        description: "It may be unplugged or in use by another app.",
      });
    }
  };

  const empty = devicesHidden(devices, kind)
    ? kind === "videoinput"
      ? "Turn your camera on to choose one."
      : `Allow ${NOUN[kind]} access to choose one.`
    : `No ${NOUN[kind]} found.`;

  if (optional && rows.length === 0) return null;

  return (
    <DropdownMenuPrimitive.Group>
      {optional && <DropdownMenuPrimitive.Separator className={`my-[5px] h-px ${RULE[tone]}`} />}
      <div className="flex items-center justify-between gap-3 px-[10px] pt-[7px] pb-[5px]">
        <DropdownMenuPrimitive.Label className={`text-[12px] font-semibold ${LABEL[tone]}`}>{HEADING[kind]}</DropdownMenuPrimitive.Label>
        {aside}
      </div>
      {rows.length === 0 ? (
        <p className={`px-[10px] pt-0.5 pb-[7px] text-[12.5px] ${MUTED_TEXT[tone]}`}>{empty}</p>
      ) : (
        <DropdownMenuPrimitive.RadioGroup aria-label={HEADING[kind]} value={checked} onValueChange={(id) => void choose(id)}>
          {rows.map((row) => (
            <DropdownMenuPrimitive.RadioItem
              key={row.id}
              value={row.id}
              className={`relative flex min-h-[30px] cursor-default items-center py-[7px] pr-[10px] pl-[32px] text-[13px] font-medium outline-hidden select-none ${ROW[tone]}`}
            >
              <span className="pointer-events-none absolute left-[10px] flex size-[15px] items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                  <CheckIcon className="size-[14px] text-primary" aria-hidden="true" />
                </DropdownMenuPrimitive.ItemIndicator>
              </span>
              <span className="min-w-0">
                <span className="block truncate">{row.label}</span>
                {row.detail && <span className={`block truncate text-[11.5px] font-normal ${MUTED_TEXT[tone]}`}>{row.detail}</span>}
              </span>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
      )}
    </DropdownMenuPrimitive.Group>
  );
}

const BAR_HEIGHTS = ["h-[4px]", "h-[6px]", "h-[8px]", "h-[10px]", "h-[12px]"];

/** Five bars that follow your voice, so you can tell the chosen mic is the one hearing you. */
function MicLevel({ tone }: { tone: HuddleTone }) {
  const { microphoneTrack, isMicrophoneEnabled } = useLocalParticipant();
  const track = microphoneTrack?.track as LocalAudioTrack | undefined;
  const volume = useTrackVolume(track);
  if (!track) return null;
  if (!isMicrophoneEnabled) return <span className={`text-[11.5px] font-medium ${MUTED_TEXT[tone]}`}>Muted</span>;
  const lit = Math.round(Math.min(1, volume * 1.5) * BAR_HEIGHTS.length);
  return (
    <span className="flex h-3 items-end gap-[2px]" data-level={lit} aria-hidden="true">
      {BAR_HEIGHTS.map((h, i) => (
        <span key={h} className={`w-[3px] rounded-full transition-colors duration-75 ${h} ${i < lit ? "bg-presence" : tone === "dark" ? "bg-white/15" : "bg-border-strong"}`} />
      ))}
    </span>
  );
}

export function AudioSettingsMenu({ tone }: { tone: HuddleTone }) {
  // Probed on open, in the browser; the menu never renders on the server.
  const speakers = canChooseSpeaker();
  return (
    <>
      <DeviceSection kind="audioinput" tone={tone} aside={<MicLevel tone={tone} />} />
      {speakers && <DeviceSection kind="audiooutput" tone={tone} optional />}
    </>
  );
}

export function VideoSettingsMenu({ tone }: { tone: HuddleTone }) {
  return <DeviceSection kind="videoinput" tone={tone} />;
}

/**
 * Rows for the huddle's audio and video menus, from `enumerateDevices()`.
 *
 * Browsers hand back lists written for machines. Chrome adds a "default" entry
 * that follows the system setting and labels it "Default - <device>", adds a
 * "communications" twin on Windows, and appends USB vendor ids such as
 * "(046d:085e)". Before a permission is granted it leaves labels empty, and
 * Safari leaves the ids empty too. This turns that into what a person picks
 * from: the system default first, named devices after it, numbered stand-ins
 * when the browser won't say more.
 */
export type MediaKind = "audioinput" | "audiooutput" | "videoinput";

export type DeviceRow = {
  id: string;
  label: string;
  /** Second line, only for the system default: which device that currently is. */
  detail?: string;
};

type DeviceLike = Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">;

const NOUN: Record<MediaKind, string> = {
  audioinput: "Microphone",
  audiooutput: "Speaker",
  videoinput: "Camera",
};

const USB_IDS = /\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i;

/** "Logitech BRIO (046d:085e)" → "Logitech BRIO". */
export function cleanDeviceLabel(label: string): string {
  return label.replace(USB_IDS, "").trim();
}

export function deviceRows(devices: DeviceLike[], kind: MediaKind): DeviceRow[] {
  const ofKind = devices.filter((d) => d.kind === kind && d.deviceId !== "" && d.deviceId !== "communications");
  const rows: DeviceRow[] = [];
  const fallback = ofKind.find((d) => d.deviceId === "default");
  if (fallback) {
    const current = cleanDeviceLabel(fallback.label.replace(/^Default\s*-\s*/i, ""));
    rows.push({ id: "default", label: "System default", ...(current ? { detail: current } : {}) });
  }
  let n = 0;
  for (const d of ofKind) {
    if (d.deviceId === "default") continue;
    n += 1;
    rows.push({ id: d.deviceId, label: cleanDeviceLabel(d.label) || `${NOUN[kind]} ${n}` });
  }
  return rows;
}

/**
 * True when the browser admits devices of this kind exist but hides their ids
 * until the page is allowed to use one, as Safari does for cameras.
 */
export function devicesHidden(devices: DeviceLike[], kind: MediaKind): boolean {
  const ofKind = devices.filter((d) => d.kind === kind);
  return ofKind.length > 0 && ofKind.every((d) => d.deviceId === "");
}

/** Which row gets the check: the active device, else the system default, else the first. */
export function checkedRow(rows: DeviceRow[], activeId: string | undefined): string | undefined {
  if (activeId && rows.some((r) => r.id === activeId)) return activeId;
  return rows.find((r) => r.id === "default")?.id ?? rows[0]?.id;
}

/** Choosing a speaker needs `setSinkId`, which Safari lacks. */
export function canChooseSpeaker(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

export type RememberedDevice = { id: string; label: string };

/**
 * Where a remembered device is in the current list. Its id if the browser
 * still uses it, otherwise a device with the same name: without a lasting
 * permission (Chrome's "Allow this time") the browser hands out new ids on
 * every visit, while names stay put.
 */
export function findRemembered(remembered: RememberedDevice | undefined, available: DeviceLike[], kind: MediaKind): string | undefined {
  if (!remembered || typeof remembered !== "object" || !remembered.id) return undefined;
  const ofKind = available.filter((d) => d.kind === kind && d.deviceId !== "");
  if (ofKind.some((d) => d.deviceId === remembered.id)) return remembered.id;
  if (!remembered.label) return undefined;
  return ofKind.find((d) => d.deviceId !== "default" && d.deviceId !== "communications" && d.label === remembered.label)?.deviceId;
}

type CaptureDefaults = { deviceId: { exact: string } };

/**
 * Room options that start a huddle on the devices picked last time, for the
 * ones still plugged in. A remembered device is required exactly: as a mere
 * preference Chrome is free to open the system default instead, and does.
 * One that has gone away is left out, so the huddle starts on the default
 * rather than failing to open a microphone that isn't there.
 */
export function rememberedDevices(
  saved: Partial<Record<MediaKind, RememberedDevice>>,
  available: DeviceLike[],
): { audioCaptureDefaults?: CaptureDefaults; videoCaptureDefaults?: CaptureDefaults; audioOutput?: { deviceId: string } } {
  const mic = findRemembered(saved.audioinput, available, "audioinput");
  const camera = findRemembered(saved.videoinput, available, "videoinput");
  const speaker = findRemembered(saved.audiooutput, available, "audiooutput");
  return {
    ...(mic ? { audioCaptureDefaults: { deviceId: { exact: mic } } } : {}),
    ...(camera ? { videoCaptureDefaults: { deviceId: { exact: camera } } } : {}),
    ...(speaker ? { audioOutput: { deviceId: speaker } } : {}),
  };
}

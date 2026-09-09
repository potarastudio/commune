/** Time presets for "send later" and "remind me" (§5 Phase 3). Pure; zone-aware via Intl. */

export type TimePreset = { id: string; label: string; at: Date };

/** Minutes east of UTC for `date` in `timezone`. */
function offsetMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** The instant at `hour:minute` local time on the local date `dayOffset` days from `now`. */
export function atLocalTime(now: Date, timezone: string, dayOffset: number, hour: number, minute = 0): Date {
  try {
    const off = offsetMinutes(now, timezone);
    const local = new Date(now.getTime() + off * 60_000);
    const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, hour, minute) - off * 60_000;
    // One correction for a DST change between now and the target.
    const off2 = offsetMinutes(new Date(guess), timezone);
    return new Date(guess - (off2 - off) * 60_000);
  } catch {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hour, minute, 0, 0);
    return d;
  }
}

/** Local weekday (0 = Sunday) of `now` in `timezone`. */
export function localWeekday(now: Date, timezone: string): number {
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  } catch {
    return now.getUTCDay();
  }
}

function nextWeekdayOffset(now: Date, timezone: string, target: number): number {
  const today = localWeekday(now, timezone);
  const diff = (target - today + 7) % 7;
  return diff === 0 ? 7 : diff;
}

/** Presets for sending a message later. Workday mornings at 09:00 local. */
export function sendLaterPresets(now = new Date(), timezone = "Asia/Jakarta"): TimePreset[] {
  const tomorrow = atLocalTime(now, timezone, 1, 9);
  const monday = atLocalTime(now, timezone, nextWeekdayOffset(now, timezone, 1), 9);
  const wd = localWeekday(now, timezone);
  return [
    { id: "1h", label: "In 1 hour", at: new Date(now.getTime() + 60 * 60_000) },
    { id: "tomorrow", label: "Tomorrow at 09:00", at: tomorrow },
    // "Next Monday" only earns a slot when tomorrow isn't already Monday.
    ...(wd === 0 ? [] : [{ id: "monday", label: "Monday at 09:00", at: monday }]),
  ];
}

/** Presets for "remind me about this". */
export function reminderPresets(now = new Date(), timezone = "Asia/Jakarta"): TimePreset[] {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return [
    { id: "20m", label: "In 20 minutes", at: new Date(now.getTime() + 20 * 60_000) },
    { id: "1h", label: "In 1 hour", at: new Date(now.getTime() + 60 * 60_000) },
    { id: "3h", label: "In 3 hours", at: new Date(now.getTime() + 3 * 60 * 60_000) },
    ...(hour < 13 ? [{ id: "today", label: "This afternoon at 14:00", at: atLocalTime(now, timezone, 0, 14) }] : []),
    { id: "tomorrow", label: "Tomorrow at 09:00", at: atLocalTime(now, timezone, 1, 9) },
    { id: "monday", label: "Next Monday at 09:00", at: atLocalTime(now, timezone, nextWeekdayOffset(now, timezone, 1), 9) },
  ];
}

/** "Tomorrow at 09:00", "Mon 14 Sep at 09:00", "Today at 15:20". */
export function describeWhen(at: Date | string, timezone = "Asia/Jakarta", now = new Date()): string {
  const d = typeof at === "string" ? new Date(at) : at;
  try {
    const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short" }).format(x);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    if (day(d) === day(now)) return `Today at ${time}`;
    if (day(d) === day(new Date(now.getTime() + 24 * 60 * 60_000))) return `Tomorrow at ${time}`;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("weekday")} ${get("day")} ${get("month")} at ${time}`;
  } catch {
    return d.toISOString();
  }
}

/** A datetime-local input value (no zone) interpreted in the user's zone. */
export function fromLocalInput(value: string, timezone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = new Date(Date.UTC(y, mo - 1, d, h, mi));
  try {
    const off = offsetMinutes(naive, timezone);
    return new Date(naive.getTime() - off * 60_000);
  } catch {
    return naive;
  }
}

/** User status helpers (§5 Phase 3): emoji + text + optional expiry. Pure; shared by UI and tests. */

export type StatusFields = { status_emoji: string | null; status_text: string | null; status_expires_at: string | null };

export type StatusExpiry = "never" | "30m" | "1h" | "4h" | "today" | "week";

export const STATUS_EXPIRY_OPTIONS: { value: StatusExpiry; label: string }[] = [
  { value: "never", label: "Don't clear" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

export const STATUS_TEXT_MAX = 100;

/** A status counts while it has text or an emoji and has not expired. */
export function isStatusActive(p: StatusFields, now = new Date()): boolean {
  if (!p.status_emoji && !p.status_text) return false;
  if (p.status_expires_at && new Date(p.status_expires_at).getTime() <= now.getTime()) return false;
  return true;
}

/** Wall-clock parts of `now` in a timezone, falling back to UTC when the zone is unknown. */
function localParts(now: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
      second: Number(get("second")),
      weekday: Math.max(0, weekdays.indexOf(get("weekday"))),
    };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes(), second: now.getUTCSeconds(), weekday: now.getUTCDay() };
  }
}

/**
 * When a status should clear, as an ISO timestamp, or null for "don't clear".
 * "Today" ends at midnight and "This week" at Sunday midnight in the user's own timezone.
 */
export function statusExpiresAt(choice: StatusExpiry, now = new Date(), timezone = "Asia/Jakarta"): string | null {
  const ms = now.getTime();
  switch (choice) {
    case "never":
      return null;
    case "30m":
      return new Date(ms + 30 * 60_000).toISOString();
    case "1h":
      return new Date(ms + 60 * 60_000).toISOString();
    case "4h":
      return new Date(ms + 4 * 60 * 60_000).toISOString();
    case "today":
    case "week": {
      const { hour, minute, second, weekday } = localParts(now, timezone);
      const untilMidnight = ((24 - hour) * 60 - minute) * 60_000 - second * 1000;
      const extraDays = choice === "week" ? (7 - weekday) % 7 : 0;
      return new Date(ms + untilMidnight + extraDays * 24 * 60 * 60_000).toISOString();
    }
  }
}

/** "Until 17:30" / "Until Sun" for the card and editor. */
export function describeExpiry(iso: string | null, timezone: string, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  try {
    const sameDay = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "short" }).format(d) === new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "short" }).format(now);
    return sameDay
      ? `Until ${new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d)}`
      : `Until ${new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)}`;
  } catch {
    return null;
  }
}

/** "14:05 local time" for someone in another zone; null when it is the viewer's own zone. */
export function localTimeLabel(timezone: string, viewerTimezone: string, now = new Date()): string | null {
  if (timezone === viewerTimezone) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  } catch {
    return null;
  }
}

import { differenceInMinutes } from "date-fns";

/**
 * Times in the viewer's time zone (§6), identical on the server and in the
 * browser.
 *
 * Every function takes the zone explicitly. Client components render on the
 * server too, and Vercel's runtime is UTC, so anything that leaned on the
 * runtime's own zone (date-fns format, isToday, toLocaleDateString) drew
 * Jakarta times seven hours off in the server HTML and then disagreed with
 * the browser during hydration. It also ignored the profile's Time zone
 * setting. The viewer's zone comes from their profile, handed down by the app
 * layout through useViewerTimezone().
 *
 * Only numbers are taken from Intl. Month and weekday names come from the
 * fixed lists below: ICU versions disagree on abbreviations (Node's en-GB
 * says "Sept", date-fns and the design say "Sep"), and a server and browser
 * with different ICU data would otherwise render different text.
 */
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The zone itself if Intl knows it, otherwise the studio's default. Never throws. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIMEZONE;
  try {
    formatterFor(timeZone);
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

type Zoned = { year: number; month: number; day: number; hour: number; minute: number; weekday: number; calendarDay: number };

function zoned(input: string | Date, timeZone: string): Zoned {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = formatterFor(safeTimeZone(timeZone)).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const midnight = Date.UTC(year, month - 1, day);
  return {
    year,
    month,
    day,
    // Some engines have said "24" for midnight even with h23.
    hour: get("hour") % 24,
    minute: get("minute"),
    weekday: new Date(midnight).getUTCDay(),
    calendarDay: Math.round(midnight / 86_400_000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Days since 1970-01-01 of the instant's calendar date in `timeZone`; equal numbers mean the same day. */
export function calendarDay(input: string | Date, timeZone: string): number {
  return zoned(input, timeZone).calendarDay;
}

/** Calendar days from the instant's date to today's, in `timeZone`: 0 is today, 1 is yesterday. */
export function daysAgo(input: string | Date, timeZone: string, now: Date = new Date()): number {
  return calendarDay(now, timeZone) - calendarDay(input, timeZone);
}

/** "21:07" */
export function formatMessageTime(iso: string, timeZone: string): string {
  const z = zoned(iso, timeZone);
  return `${pad(z.hour)}:${pad(z.minute)}`;
}

/** "Today", "Yesterday", "Thursday, 3 September", or with the year when it isn't this one. */
export function formatDayLabel(iso: string, timeZone: string, now: Date = new Date()): string {
  const z = zoned(iso, timeZone);
  const today = zoned(now, timeZone);
  const ago = today.calendarDay - z.calendarDay;
  if (ago === 0) return "Today";
  if (ago === 1) return "Yesterday";
  const label = `${WEEKDAYS[z.weekday]}, ${z.day} ${MONTHS[z.month - 1]}`;
  return z.year === today.year ? label : `${label} ${z.year}`;
}

/** "Thursday, 10 September 2026 at 21:07", for tooltips and edit history. */
export function formatFullTimestamp(iso: string, timeZone: string): string {
  const z = zoned(iso, timeZone);
  return `${WEEKDAYS[z.weekday]}, ${z.day} ${MONTHS[z.month - 1]} ${z.year} at ${pad(z.hour)}:${pad(z.minute)}`;
}

/** "10 Sep", or "10 Sep 2025" when it isn't this year. */
export function formatShortDate(iso: string, timeZone: string, now: Date = new Date()): string {
  const z = zoned(iso, timeZone);
  const label = `${z.day} ${MONTHS_SHORT[z.month - 1]}`;
  return z.year === zoned(now, timeZone).year ? label : `${label} ${z.year}`;
}

/** "10 September 2026", for created and joined dates. */
export function formatLongDate(iso: string, timeZone: string): string {
  const z = zoned(iso, timeZone);
  return `${z.day} ${MONTHS[z.month - 1]} ${z.year}`;
}

/** "Thu" */
export function formatWeekdayShort(iso: string, timeZone: string): string {
  return WEEKDAYS_SHORT[zoned(iso, timeZone).weekday];
}

export function sameDay(a: string, b: string, timeZone: string): boolean {
  return calendarDay(a, timeZone) === calendarDay(b, timeZone);
}

/** Consecutive messages from the same author within 5 minutes are grouped (§5), never across a day break. */
export function shouldGroup(
  prev: { author_id: string; created_at: string } | undefined,
  next: { author_id: string; created_at: string },
  timeZone: string,
): boolean {
  if (!prev) return false;
  if (prev.author_id !== next.author_id) return false;
  if (!sameDay(prev.created_at, next.created_at, timeZone)) return false;
  return Math.abs(differenceInMinutes(new Date(next.created_at), new Date(prev.created_at))) < 5;
}

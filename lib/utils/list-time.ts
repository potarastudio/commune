import { daysAgo, formatMessageTime, formatShortDate, formatWeekdayShort } from "./time";

/**
 * A list row's time (design: Mobile Core Screens → Messages): the clock today,
 * "Yesterday", the weekday within the week, then the date. In the viewer's
 * zone, like every time the app draws.
 */
export function listTime(iso: string, timeZone: string, now: Date = new Date()): string {
  const ago = daysAgo(iso, timeZone, now);
  if (ago <= 0) return formatMessageTime(iso, timeZone);
  if (ago === 1) return "Yesterday";
  if (ago < 7) return formatWeekdayShort(iso, timeZone);
  return formatShortDate(iso, timeZone, now);
}

/**
 * A feed row's time (design: Mobile Core Screens → Activity), which also has
 * to say when on the day: "11:31" today, "Yesterday 09:40", then "10 Sep, 14:07".
 */
export function feedTime(iso: string, timeZone: string, now: Date = new Date()): string {
  const ago = daysAgo(iso, timeZone, now);
  if (ago <= 0) return formatMessageTime(iso, timeZone);
  if (ago === 1) return `Yesterday ${formatMessageTime(iso, timeZone)}`;
  return `${formatShortDate(iso, timeZone, now)}, ${formatMessageTime(iso, timeZone)}`;
}

/** Minutes a zone is ahead of UTC at a moment, read from Intl ("GMT+7", "GMT-3:30"). */
function zoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (!name) return null;
    if (name === "GMT") return 0;
    const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name);
    if (!m) return null;
    const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return m[1] === "-" ? -minutes : minutes;
  } catch {
    return null;
  }
}

/**
 * How someone's clock sits against yours, for a profile: "same time as you",
 * "1 hour behind you", "5½ hours ahead of you".
 */
export function zoneDifference(theirs: string, mine: string, now: Date = new Date()): string | null {
  const a = zoneOffsetMinutes(theirs, now);
  const b = zoneOffsetMinutes(mine, now);
  if (a === null || b === null) return null;
  const diff = a - b;
  if (diff === 0) return "same time as you";
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 60);
  const half = abs % 60 === 30;
  const amount =
    abs % 60 === 0 || half
      ? `${hours === 0 && half ? "½" : `${hours}${half ? "½" : ""}`} ${hours === 1 && !half ? "hour" : "hours"}`
      : `${abs} minutes`;
  return diff < 0 ? `${amount} behind you` : `${amount} ahead of you`;
}

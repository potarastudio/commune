import { differenceInMinutes, format, isSameDay, isThisYear, isToday, isYesterday } from "date-fns";

/** Times are shown in the viewer's timezone (§6); the browser provides it. */
export function formatMessageTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, isThisYear(d) ? "EEEE, d MMMM" : "EEEE, d MMMM yyyy");
}

export function formatFullTimestamp(iso: string): string {
  return format(new Date(iso), "EEEE, d MMMM yyyy 'at' HH:mm");
}

export function sameDay(a: string, b: string): boolean {
  return isSameDay(new Date(a), new Date(b));
}

/** Consecutive messages from the same author within 5 minutes are grouped (§5). */
export function shouldGroup(
  prev: { author_id: string; created_at: string } | undefined,
  next: { author_id: string; created_at: string },
): boolean {
  if (!prev) return false;
  if (prev.author_id !== next.author_id) return false;
  if (!sameDay(prev.created_at, next.created_at)) return false;
  return Math.abs(differenceInMinutes(new Date(next.created_at), new Date(prev.created_at))) < 5;
}

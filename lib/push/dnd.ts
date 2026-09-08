/** Do Not Disturb window check in the user's own timezone. Pure; shared by push fan-out and tests. */
export function inDoNotDisturb(
  profile: { dnd_start: string | null; dnd_end: string | null; timezone: string },
  now = new Date(),
): boolean {
  if (!profile.dnd_start || !profile.dnd_end) return false;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  let local: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    local = h * 60 + m;
  } catch {
    local = now.getUTCHours() * 60 + now.getUTCMinutes();
  }
  const start = toMinutes(profile.dnd_start);
  const end = toMinutes(profile.dnd_end);
  // Overnight windows (22:00 → 07:00) wrap past midnight.
  return start <= end ? local >= start && local < end : local >= start || local < end;
}

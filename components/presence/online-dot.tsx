"use client";

import { useIsOnline, usePresenceStore } from "@/lib/store/presence";

/**
 * The surface a dot sits on, so its 2px ring can punch a clean hole in it.
 * Both halves are written as literal class names so Tailwind's scanner sees
 * them, and `Surface` keeps callers to rings this map actually covers — an
 * unmapped ring would render a coloured crescent.
 */
const SURFACE = {
  "border-bg-main": "bg-bg-main",
  "border-bg-col": "bg-bg-col",
  "border-bg-card": "bg-bg-card",
  "border-bg-chip": "bg-bg-chip",
  "border-bg-subtle": "bg-bg-subtle",
  "border-rail": "bg-rail",
} as const;

export type PresenceSurface = keyof typeof SURFACE;

/**
 * The design draws the dot at two sizes: 10px beside a 32px header avatar and
 * 8px beside a 22px sidebar avatar. Both keep the 2px ring, so the 8px one
 * reads as a 4px core.
 */
const SIZE = { sm: "size-2", md: "size-2.5" } as const;

export type PresenceSize = keyof typeof SIZE;

/**
 * True once the workspace presence channel has reported at all. Until then
 * nobody is "away" — they are merely unknown — so callers must not draw the
 * hollow ring. Header and sidebar share this so they can never disagree.
 */
export function usePresenceKnown(): boolean {
  return usePresenceStore((s) => s.online.size > 0);
}

/**
 * The presence dot itself: a 2px ring in the surface behind it, filled green
 * when active and a hollow tertiary ring when away. Callers supply the display
 * utility (`block`, `inline-block`) so nothing fights over it.
 */
export function PresenceDot({
  active,
  ring = "border-bg-main",
  size = "md",
  className = "",
  label,
}: {
  active: boolean;
  ring?: PresenceSurface;
  size?: PresenceSize;
  className?: string;
  label?: string;
}) {
  const surface = SURFACE[ring];
  return (
    <span
      className={`${SIZE[size]} shrink-0 rounded-full border-2 ${ring} ${active ? "bg-presence" : surface} ${className}`}
      aria-label={label ?? (active ? "Active" : "Away")}
      role="img"
    >
      {!active && <span className="block size-full rounded-full border-2 border-tertiary" />}
    </span>
  );
}

/**
 * Presence dot for a person, inline in a row of text. Renders nothing for
 * someone who is offline — the design gives them no dot, and the store cannot
 * tell "offline" from "away".
 */
export function OnlineDot({ userId, className = "" }: { userId: string; className?: string }) {
  const online = useIsOnline(userId);
  if (!online) return null;
  return <PresenceDot active className={`inline-block align-middle ${className}`} />;
}

/**
 * Avatar-corner variant used on lists and headers. Hidden for people who are
 * simply offline (the design shows no dot for them); pass `away` where an idle
 * signal exists — `usePresenceKnown()` — to get the hollow ring instead.
 */
export function AvatarPresence({
  userId,
  ring = "border-bg-main",
  size = "md",
  away = false,
}: {
  userId: string;
  ring?: PresenceSurface;
  size?: PresenceSize;
  away?: boolean;
}) {
  const online = useIsOnline(userId);
  if (!online && !away) return null;
  return <PresenceDot active={online} ring={ring} size={size} className="absolute -right-px -bottom-px block" />;
}

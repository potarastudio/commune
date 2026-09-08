"use client";

import { useIsOnline } from "@/lib/store/presence";

/** Presence dot for a person: filled when they are online, hollow otherwise. */
export function OnlineDot({ userId, className = "" }: { userId: string; className?: string }) {
  const online = useIsOnline(userId);
  return (
    <span
      className={`inline-block size-2 rounded-full ${online ? "bg-online" : "border border-current opacity-40"} ${className}`}
      aria-label={online ? "Online" : "Away"}
      role="img"
    />
  );
}

/** Avatar-corner variant used on lists and headers. */
export function AvatarPresence({ userId, ring = "border-background" }: { userId: string; ring?: string }) {
  const online = useIsOnline(userId);
  if (!online) return null;
  return <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 bg-online ${ring}`} aria-label="Online" role="img" />;
}

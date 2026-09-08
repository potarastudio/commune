"use client";

import { create } from "zustand";

/** Who is online right now, from the workspace-wide Presence topic. Ephemeral UI state. */
type PresenceState = {
  online: Set<string>;
  setOnline: (ids: Iterable<string>) => void;
};

export const usePresenceStore = create<PresenceState>()((set) => ({
  online: new Set(),
  setOnline: (ids) => set({ online: new Set(ids) }),
}));

export function useIsOnline(userId: string | null | undefined): boolean {
  return usePresenceStore((s) => (userId ? s.online.has(userId) : false));
}

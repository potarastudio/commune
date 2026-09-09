"use client";

import { create } from "zustand";

/** The signed-in user's id, set once by the app shell so deep components (mention chips) can tell "me" apart. */
type SessionState = { meId: string | null; setMeId: (id: string) => void };

export const useSessionStore = create<SessionState>()((set) => ({
  meId: null,
  setMeId: (id) => set({ meId: id }),
}));

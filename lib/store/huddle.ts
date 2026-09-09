"use client";

import { create } from "zustand";
import type { Container } from "@/lib/queries/messages";

/** The huddle this browser is currently connected to. UI state only; the rows live in Postgres. */
export type HuddleSession = {
  huddleId: string;
  room: string;
  token: string;
  url: string;
  container: Container;
  /** "#design" or "Nadia Putri" for the dock and the stage header. */
  label: string;
  /** Where "back to chat" goes. */
  href: string;
};

type HuddleState = {
  session: HuddleSession | null;
  connecting: boolean;
  setConnecting: (v: boolean) => void;
  start: (s: HuddleSession) => void;
  clear: () => void;
};

export const useHuddleStore = create<HuddleState>()((set) => ({
  session: null,
  connecting: false,
  setConnecting: (v) => set({ connecting: v }),
  start: (s) => set({ session: s, connecting: false }),
  clear: () => set({ session: null, connecting: false }),
}));

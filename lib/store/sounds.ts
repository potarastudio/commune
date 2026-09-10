"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Which tone plays for a message that reaches you, and whether huddles chime.
 * "none" is the off switch, the way Slack's sound menu ends in "None".
 *
 * Kept per device in localStorage rather than on the profile, like Slack does.
 * A sound is a property of the machine making it: the same person may want a
 * chime on the studio Mac and silence on a laptop in a café, and the server
 * never needs to know the choice. A profile column would also mean a
 * migration, a type regen and RLS for a cosmetic per-device setting.
 */
// Order is the picker's order. Sampled sounds sit after the tones; None stays
// last because it is the off switch, not a sound.
export const SOUND_NAMES = ["ping", "chime", "knock", "pop", "lawan", "none"] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

export const SOUND_LABELS: Record<SoundName, string> = {
  ping: "Ping",
  chime: "Chime",
  knock: "Knock",
  pop: "Pop",
  lawan: "Saya akan lawan",
  none: "None",
};

type SoundState = {
  sound: SoundName;
  setSound: (sound: SoundName) => void;
};

export const useSoundStore = create<SoundState>()(
  persist((set) => ({ sound: "ping", setSound: (sound) => set({ sound }) }), { name: "commune-sounds" }),
);

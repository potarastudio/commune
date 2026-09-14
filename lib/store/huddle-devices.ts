"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MediaKind, RememberedDevice } from "@/lib/utils/media-devices";

/**
 * The microphone, speaker and camera last picked in a huddle's menus, so the
 * next huddle starts on them.
 *
 * Per device in localStorage, like the notification sound: a device only means
 * something on the machine that has it. The name is kept beside the id because
 * a browser without a lasting permission issues new ids on every visit.
 */
type HuddleDevicesState = Partial<Record<MediaKind, RememberedDevice>> & {
  setDevice: (kind: MediaKind, device: RememberedDevice) => void;
};

export const useHuddleDevices = create<HuddleDevicesState>()(
  persist((set) => ({ setDevice: (kind, device) => set({ [kind]: device }) }), { name: "commune-huddle-devices" }),
);

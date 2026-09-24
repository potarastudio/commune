"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { applyNavigation, emptyStacks, synthesizeStack, type Intent, type NavState } from "@/lib/mobile";

type MobileNavStore = NavState & {
  /** What the app asked for, consumed by the next URL change (see lib/mobile.ts applyNavigation). */
  intent: Intent | null;
  /** Where a surface (search, new message, huddle) was opened from, and whether history can simply go back to it. */
  surface: { from: string; viaPush: boolean } | null;
  /** What each screen was called, by URL, so a hint can name a screen left open in another tab. */
  titles: Record<string, string>;
  setIntent: (intent: Intent | null) => void;
  setTitle: (url: string, title: string) => void;
  setSurface: (surface: MobileNavStore["surface"]) => void;
  apply: (url: string) => void;
  /**
   * A notification or a link from outside the app: build the stack that
   * would have led there in its own tab, so Back goes somewhere sensible
   * (design: Mobile Navigation → Deep link).
   */
  arriveFromOutside: (url: string) => void;
};

/**
 * The phone's per-tab history (§ design Mobile Navigation: "five stacks, one
 * per tab"). The address bar stays the source of truth for where you are;
 * this remembers where each tab had got to. Kept for the session, so a reload
 * — or the app recovering a reclaimed page — keeps your place in every tab.
 */
export const useMobileNavStore = create<MobileNavStore>()(
  persist(
    (set, get) => ({
      active: null,
      stacks: emptyStacks(),
      intent: null,
      surface: null,
      titles: {},
      setIntent: (intent) => set({ intent }),
      setTitle: (url, title) => {
        const titles = { ...get().titles, [url]: title };
        // Only the screens still in some stack are worth remembering.
        const live = new Set(Object.values(get().stacks).flatMap((stack) => stack.map((e) => e.url)));
        for (const key of Object.keys(titles)) if (!live.has(key) && key !== url) delete titles[key];
        set({ titles });
      },
      setSurface: (surface) => set({ surface }),
      apply: (url) => {
        const { active, stacks, intent } = get();
        set({ ...applyNavigation({ active, stacks }, url, intent), intent: null });
      },
      arriveFromOutside: (url) => {
        const { tab, stack } = synthesizeStack(url);
        set({ active: tab, stacks: { ...get().stacks, [tab]: stack }, intent: { kind: "tab", tab, url } });
      },
    }),
    {
      name: "commune-mobile-nav",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ active: s.active, stacks: s.stacks, surface: s.surface, titles: s.titles }),
    },
  ),
);

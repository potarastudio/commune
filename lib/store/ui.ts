"use client";

import type { JSONContent } from "@tiptap/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** UI-only state (§2). Server data never lives here. */
type UiState = {
  drafts: Record<string, JSONContent | undefined>;
  setDraft: (key: string, doc: JSONContent | undefined) => void;
  collapsed: Record<string, boolean>;
  toggleSection: (key: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, doc) =>
        set((s) => {
          const drafts = { ...s.drafts };
          if (doc) drafts[key] = doc;
          else delete drafts[key];
          return { drafts };
        }),
      collapsed: {},
      toggleSection: (key) => set((s) => ({ collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } })),
      paletteOpen: false,
      setPaletteOpen: (open) => set({ paletteOpen: open }),
    }),
    { name: "commune-ui", partialize: (s) => ({ drafts: s.drafts, collapsed: s.collapsed }) },
  ),
);

import type { JSONContent } from "@tiptap/core";
import { create } from "zustand";

/**
 * The message being edited on the phone (design: Mobile Composer → Editing).
 * The phone edits in the composer rather than inline: the long-press sheet
 * starts it, the composer on screen picks it up (a phone shows one
 * conversation or one thread at a time, so there is only ever one), and the
 * original stays tinted in the list until it is saved or cancelled.
 */
type MobileEditState = {
  editing: { messageId: string; content: JSONContent } | null;
  start: (messageId: string, content: JSONContent) => void;
  stop: () => void;
};

export const useMobileEditStore = create<MobileEditState>((set) => ({
  editing: null,
  start: (messageId, content) => set({ editing: { messageId, content } }),
  stop: () => set({ editing: null }),
}));

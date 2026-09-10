/**
 * The custom-emoji list the composer's :shortcode: search reads, kept apart
 * from the Tiptap extension that consumes it.
 *
 * The app shell calls setCustomEmojiForComposer on every page, because the
 * presence provider fetches the studio's emoji. When this setter lived beside
 * the extension in emoji.ts, that one import pulled Tiptap and ProseMirror into
 * the shared bundle, so Settings and profile pages downloaded a rich-text
 * editor they never render. This module imports nothing.
 */
export type EmojiItem = {
  id: string;
  native: string;
  name: string;
  /** Image URL for a custom emoji; `native` is then ":name:". */
  src?: string;
};

let custom: EmojiItem[] = [];

/** Called by useCustomEmoji whenever the studio's custom set changes, so :shortcode: search includes it. */
export function setCustomEmojiForComposer(items: EmojiItem[]) {
  custom = items;
}

export function searchCustomEmoji(q: string): EmojiItem[] {
  const needle = q.toLowerCase();
  return custom.filter((e) => e.id.includes(needle)).slice(0, 4);
}

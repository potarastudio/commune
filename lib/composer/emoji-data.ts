import type { EmojiItem } from "./emoji-store";

/**
 * emoji-mart's data and search, kept apart from the Tiptap extension that also
 * uses them. The status editor and the composer's picker both want to look up
 * an emoji without wanting a rich-text editor; when this lived beside
 * EmojiSuggestion, the sidebar's user menu pulled Tiptap into every page.
 *
 * emoji-mart itself is already dynamically imported below, so nothing here
 * lands in a bundle until someone actually opens a picker.
 */
type EmojiMartData = {
  emojis: Record<string, { id: string; name: string; keywords: string[]; skins: { native: string }[] }>;
};

let cache: Promise<{ data: EmojiMartData; search: (q: string) => Promise<EmojiItem[]> }> | undefined;

/** emoji-mart's data and search index, loaded on first use (it is ~400 KB). */
export function loadEmoji() {
  cache ??= Promise.all([import("@emoji-mart/data"), import("emoji-mart")]).then(([dataMod, mart]) => {
    const data = dataMod.default as EmojiMartData;
    void mart.init({ data });
    return {
      data,
      async search(q: string): Promise<EmojiItem[]> {
        const results = (await mart.SearchIndex.search(q)) as EmojiMartData["emojis"][string][] | null;
        return (results ?? []).slice(0, 8).map((e) => ({ id: e.id, native: e.skins[0].native, name: e.name }));
      },
    };
  });
  return cache;
}

/** Look up a shortcode like "fire" → "🔥". */
export async function emojiFromShortcode(code: string): Promise<string | null> {
  const { data } = await loadEmoji();
  return data.emojis[code]?.skins[0]?.native ?? null;
}

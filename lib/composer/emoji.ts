import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EmojiList } from "@/components/message/emoji-list";
import { suggestionRender } from "./suggestion-render";

export type EmojiItem = { id: string; native: string; name: string };

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

/** `:shortcode:` autocomplete after two characters, inserting the unicode emoji. */
export const EmojiSuggestion = Extension.create({
  name: "emojiSuggestion",
  addProseMirrorPlugins() {
    return [
      Suggestion<EmojiItem>({
        editor: this.editor,
        pluginKey: undefined,
        char: ":",
        allowSpaces: false,
        allowedPrefixes: [" "],
        startOfLine: false,
        items: async ({ query }) => {
          if (query.length < 2) return [];
          const { search } = await loadEmoji();
          return search(query);
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, `${props.native} `).run();
        },
        render: suggestionRender<EmojiItem>(EmojiList as React.ComponentType<SuggestionProps<EmojiItem>>),
      }),
    ];
  },
});

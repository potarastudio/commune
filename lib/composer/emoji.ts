import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EmojiList } from "@/components/message/emoji-list";
import { loadEmoji } from "./emoji-data";
import { searchCustomEmoji, type EmojiItem } from "./emoji-store";
import { suggestionRender } from "./suggestion-render";

export { setCustomEmojiForComposer, type EmojiItem } from "./emoji-store";
export { emojiFromShortcode, loadEmoji } from "./emoji-data";

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
          const mine = searchCustomEmoji(query);
          return [...mine, ...(await search(query))].slice(0, 8);
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, `${props.native} `).run();
        },
        render: suggestionRender<EmojiItem>(EmojiList as React.ComponentType<SuggestionProps<EmojiItem>>),
      }),
    ];
  },
});

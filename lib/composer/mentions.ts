import Mention from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import { MentionList } from "@/components/message/mention-list";
import { suggestionRender } from "./suggestion-render";

export type MentionItem = {
  id: string;
  label: string;
  name: string;
  avatar_url: string | null;
  special?: boolean;
};

export const BROADCAST_ITEMS: MentionItem[] = [
  { id: "channel", label: "channel", name: "Notify everyone in this channel", avatar_url: null, special: true },
  { id: "here", label: "here", name: "Notify members who are online", avatar_url: null, special: true },
];

/**
 * @mention autocomplete. Mention nodes store { id: <profile uuid> | "channel" | "here", label }
 * which is exactly what extract_mentions() in the database reads.
 */
export function createMentionExtension(getItems: () => MentionItem[]) {
  return Mention.configure({
    HTMLAttributes: { class: "mention" },
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
    deleteTriggerWithBackspace: true,
    suggestion: {
      char: "@",
      allowSpaces: false,
      items: ({ query }) => {
        const q = query.toLowerCase();
        return getItems()
          .filter((p) => q === "" || p.label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
          .slice(0, 8);
      },
      command: ({ editor, range, props }) => {
        const item = props as MentionItem;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: "mention", attrs: { id: item.id, label: item.label } },
            { type: "text", text: " " },
          ])
          .run();
      },
      render: suggestionRender<MentionItem>(MentionList as React.ComponentType<SuggestionProps<MentionItem>>),
    },
  });
}

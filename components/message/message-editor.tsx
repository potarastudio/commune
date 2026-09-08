"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmojiSuggestion } from "@/lib/composer/emoji";
import { BROADCAST_ITEMS, createMentionExtension, type MentionItem } from "@/lib/composer/mentions";
import { useProfiles } from "@/lib/queries/profiles";
import { isEmptyDoc } from "@/lib/utils/tiptap";

/** Inline edit for an existing message (§6: inline edit over a modal). Enter saves, Esc cancels. */
export function MessageEditor({
  content,
  allowBroadcast,
  onSave,
  onCancel,
}: {
  content: JSONContent;
  allowBroadcast: boolean;
  onSave: (doc: JSONContent) => void;
  onCancel: () => void;
}) {
  const [empty, setEmpty] = useState(isEmptyDoc(content));
  const { data: profiles } = useProfiles();
  const mentionItems = useMemo<MentionItem[]>(
    () => [
      ...(profiles ?? []).map((p) => ({ id: p.id, label: p.handle, name: p.display_name, avatar_url: p.avatar_url })),
      ...(allowBroadcast ? BROADCAST_ITEMS : []),
    ],
    [profiles, allowBroadcast],
  );
  const itemsRef = useRef(mentionItems);
  itemsRef.current = mentionItems;
  const [mentionExtension] = useState(() => createMentionExtension(() => itemsRef.current));
  const submitRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: "end",
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: "Edit your message" }),
      mentionExtension,
      EmojiSuggestion,
    ],
    content,
    editorProps: {
      attributes: {
        class: "tiptap min-h-[36px] max-h-64 overflow-y-auto px-3 py-2 text-[14px] leading-[1.5] outline-none",
        "aria-label": "Edit message",
        role: "textbox",
      },
      handleKeyDown(view, event) {
        if (event.key === "Escape") {
          onCancel();
          return true;
        }
        if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.isComposing) return false;
        if (view.state.selection.$from.parent.type.name === "codeBlock") return false;
        event.preventDefault();
        submitRef.current();
        return true;
      },
    },
    onUpdate({ editor }) {
      setEmpty(isEmptyDoc(editor.getJSON()));
    },
  });

  function submit() {
    if (!editor) return;
    const doc = JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent;
    if (isEmptyDoc(doc)) return;
    onSave(doc);
  }
  submitRef.current = submit;

  return (
    <div className="mt-1 rounded-lg border border-ring bg-background shadow-xs ring-2 ring-ring/25">
      <EditorContent editor={editor} />
      <div className="flex items-center gap-2 border-t border-border/70 px-2 py-1.5">
        <span className="text-[11px] text-muted-foreground">
          <kbd className="font-sans">Enter</kbd> to save · <kbd className="font-sans">Esc</kbd> to cancel
        </span>
        <div className="ml-auto flex gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={empty} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

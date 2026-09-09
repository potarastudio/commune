"use client";

import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Code, Italic, SquareCode, Strikethrough } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmojiSuggestion } from "@/lib/composer/emoji";
import { BROADCAST_ITEMS, createMentionExtension, type MentionItem } from "@/lib/composer/mentions";
import { useProfiles } from "@/lib/queries/profiles";
import { isEmptyDoc } from "@/lib/utils/tiptap";

const KBD = "rounded-[4px] border border-border-strong bg-bg-subtle px-[5px] py-px font-sans text-[11px] font-medium text-fg-600";

function MarkButton({ label, icon: Icon, onClick }: { label: string; icon: typeof Bold; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className="grid size-7 place-items-center rounded-sm text-fg-600 hover:bg-bg-subtle hover:text-ink"
        >
          <Icon className="size-[15px]" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

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
        class: "tiptap min-h-[36px] max-h-64 overflow-y-auto px-3 py-2.5 text-[14px] leading-[1.55] outline-none",
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

  const run = (fn: (chain: ReturnType<Editor["chain"]>) => { run: () => boolean }) => () => {
    if (editor) fn(editor.chain().focus()).run();
  };

  return (
    <div className="mt-[5px]">
      <div className="rounded-lg border border-primary bg-bg-card shadow-[0_0_0_3px_var(--accent-surface)]">
        <EditorContent editor={editor} />
        <div className="flex items-center gap-0.5 border-t border-border-subtle px-2 py-1.5">
          <MarkButton label="Bold" icon={Bold} onClick={run((c) => c.toggleBold())} />
          <MarkButton label="Italic" icon={Italic} onClick={run((c) => c.toggleItalic())} />
          <MarkButton label="Strikethrough" icon={Strikethrough} onClick={run((c) => c.toggleStrike())} />
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          <MarkButton label="Code" icon={Code} onClick={run((c) => c.toggleCode())} />
          <MarkButton label="Code block" icon={SquareCode} onClick={run((c) => c.toggleCodeBlock())} />
          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-[30px] items-center rounded-[7px] border border-border-strong bg-bg-card px-[11px] text-[12.5px] font-semibold text-fg-400 hover:border-border-hover hover:bg-bg-card-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={empty}
              onClick={submit}
              className="flex h-[30px] items-center rounded-[7px] border border-accent-border bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-accent-border-hover hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
            >
              Save changes
            </button>
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        <kbd className={KBD}>Esc</kbd> to cancel · <kbd className={KBD}>Enter</kbd> to save
      </p>
    </div>
  );
}

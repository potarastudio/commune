"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Italic, List, SendHorizontal, SquareCode, Strikethrough } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/store/ui";
import { isEmptyDoc } from "@/lib/utils/tiptap";

/**
 * Tiptap composer (§5): bold/italic/strike/code/code block/links/bulleted
 * lists. Enter sends, Shift+Enter breaks a line (Enter inserts a newline
 * inside code blocks). Drafts persist per channel. Mentions and the emoji
 * picker plug in next.
 */
export function MessageComposer({
  draftKey,
  placeholder,
  onSend,
  compact = false,
}: {
  draftKey: string;
  placeholder: string;
  onSend: (content: JSONContent) => void;
  /** Narrow layouts (thread panel): hide the keyboard hint. */
  compact?: boolean;
}) {
  const draft = useUiStore((s) => s.drafts[draftKey]);
  const setDraft = useUiStore((s) => s.setDraft);
  const [empty, setEmpty] = useState(true);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  // handleKeyDown is captured once by Tiptap, before the editor exists; always call the latest submit.
  const submitRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: draft ?? "",
    editorProps: {
      attributes: {
        class: "tiptap min-h-[40px] max-h-64 overflow-y-auto px-3 py-2.5 text-[14px] leading-[1.5] outline-none",
        "aria-label": placeholder,
        role: "textbox",
        "aria-multiline": "true",
      },
      handleKeyDown(view, event) {
        if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false;
        if (event.isComposing) return false;
        const inCode = view.state.selection.$from.parent.type.name === "codeBlock";
        if (inCode) return false;
        event.preventDefault();
        submitRef.current();
        return true;
      },
    },
    onUpdate({ editor }) {
      const doc = editor.getJSON();
      const isEmpty = isEmptyDoc(doc);
      setEmpty(isEmpty);
      setDraft(draftKey, isEmpty ? undefined : doc);
    },
  });

  useEffect(() => {
    if (editor) setEmpty(isEmptyDoc(editor.getJSON()));
  }, [editor]);

  function submit() {
    if (!editor) return;

    const doc = editor.getJSON();
    if (isEmptyDoc(doc)) return;
    onSendRef.current(doc);
    editor.commands.clearContent(true);
    setDraft(draftKey, undefined);
    setEmpty(true);
  }
  submitRef.current = submit;

  const tools = editor
    ? [
        { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
        { label: "Code", icon: Code, active: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
        { label: "Code block", icon: SquareCode, active: editor.isActive("codeBlock"), run: () => editor.chain().focus().toggleCodeBlock().run() },
        { label: "Bulleted list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
      ]
    : [];

  return (
    <div className="rounded-lg border border-input bg-background shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
      <EditorContent editor={editor} />
      <div className="flex items-center gap-0.5 border-t border-border/70 px-1.5 py-1">
        {tools.map((t) => (
          <Tooltip key={t.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t.label}
                aria-pressed={t.active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.run}
                className={`grid size-7 place-items-center rounded-md ${
                  t.active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <t.icon className="size-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t.label}</TooltipContent>
          </Tooltip>
        ))}
        <span className={`ml-auto mr-1 text-[11px] text-muted-foreground ${compact ? "hidden" : "hidden sm:block"}`}>
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for a new line
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Send message"
              disabled={empty}
              onClick={submit}
              className="ml-auto grid size-7 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground"
            >
              <SendHorizontal className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Send</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

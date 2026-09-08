"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AtSign, Bold, Code, Italic, List, Paperclip, SendHorizontal, SmilePlus, SquareCode, Strikethrough } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmojiSuggestion } from "@/lib/composer/emoji";
import { BROADCAST_ITEMS, createMentionExtension, type MentionItem } from "@/lib/composer/mentions";
import { useProfiles } from "@/lib/queries/profiles";
import { useUiStore } from "@/lib/store/ui";
import type { useAttachmentUploads } from "@/lib/queries/use-uploads";
import { isEmptyDoc } from "@/lib/utils/tiptap";
import { EmojiPicker } from "./emoji-picker";
import { PendingAttachments } from "./pending-attachments";

/**
 * Tiptap composer (§5): bold/italic/strike/code/code block/links/bulleted
 * lists, @mention autocomplete, emoji picker and :shortcode: autocomplete.
 * Enter sends, Shift+Enter breaks a line (Enter inserts a newline inside
 * code blocks). Drafts persist per container.
 */
export function MessageComposer({
  draftKey,
  placeholder,
  onSend,
  compact = false,
  allowBroadcast = true,
  uploads,
}: {
  draftKey: string;
  placeholder: string;
  /** Called with the document; attachments (if any) are read from `uploads` by the caller. */
  onSend: (content: JSONContent) => void;
  /** From useAttachmentUploads(); enables the attach button, paste and the pending list. */
  uploads?: ReturnType<typeof useAttachmentUploads>;
  /** Narrow layouts (thread panel): hide the keyboard hint. */
  compact?: boolean;
  /** Offer @channel / @here (channels only). */
  allowBroadcast?: boolean;
}) {
  const draft = useUiStore((s) => s.drafts[draftKey]);
  const setDraft = useUiStore((s) => s.setDraft);
  const [empty, setEmpty] = useState(true);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mention candidates come from the profiles cache; a ref keeps the extension stable.
  const { data: profiles } = useProfiles();
  const mentionItems = useMemo<MentionItem[]>(
    () => [
      ...(profiles ?? []).map((p) => ({ id: p.id, label: p.handle, name: p.display_name, avatar_url: p.avatar_url })),
      ...(allowBroadcast ? BROADCAST_ITEMS : []),
    ],
    [profiles, allowBroadcast],
  );
  const mentionItemsRef = useRef(mentionItems);
  mentionItemsRef.current = mentionItems;
  const [mentionExtension] = useState(() => createMentionExtension(() => mentionItemsRef.current));
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
      mentionExtension,
      EmojiSuggestion,
    ],
    content: draft ?? "",
    editorProps: {
      attributes: {
        class: "tiptap min-h-[40px] max-h-64 overflow-y-auto px-3 py-2.5 text-[14px] leading-[1.5] outline-none",
        "aria-label": placeholder,
        role: "textbox",
        "aria-multiline": "true",
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0 || !uploadsRef.current) return false;
        event.preventDefault();
        uploadsRef.current.addFiles(files);
        return true;
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

  const hasFiles = (uploads?.uploads.length ?? 0) > 0;
  const uploading = uploads?.uploading ?? false;
  const canSend = (!empty || (hasFiles && uploads?.ready.length)) && !uploading;

  function submit() {
    if (!editor) return;
    if (uploadsRef.current?.uploading) return;

    // ProseMirror attrs have a null prototype, which Server Actions refuse to serialise.
    const doc = JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent;
    if (isEmptyDoc(doc) && !(uploadsRef.current?.ready.length ?? 0)) return;
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
      {uploads && <PendingAttachments uploads={uploads.uploads} onRemove={uploads.remove} />}
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
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {uploads && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach files"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach files</TooltipContent>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                if (e.target.files?.length) uploads.addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
        <EmojiPicker
          onPick={(e) => editor?.chain().focus().insertContent(`${e.native} `).run()}
        >
          <button
            type="button"
            aria-label="Add emoji"
            onMouseDown={(e) => e.preventDefault()}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SmilePlus className="size-4" aria-hidden="true" />
          </button>
        </EmojiPicker>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Mention someone"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().insertContent("@").run()}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <AtSign className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Mention someone</TooltipContent>
        </Tooltip>
        <span className={`ml-auto mr-1 text-[11px] text-muted-foreground ${compact ? "hidden" : "hidden sm:block"}`}>
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for a new line
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Send message"
              disabled={!canSend}
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

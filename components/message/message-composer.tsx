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
import { SendLaterMenu } from "./send-later";
import { Kbd } from "./suggestion-list";

/** 30px toolbar affordance from the design: fg-600 at rest, subtle fill on hover. */
const TOOL_BUTTON = "grid size-[30px] place-items-center rounded-[7px] transition-colors";
const TOOL_IDLE = "text-fg-600 hover:bg-bg-subtle hover:text-ink";
const TOOL_ACTIVE = "bg-bg-subtle text-ink";

function ToolDivider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />;
}

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
  onSchedule,
  compact = false,
  allowBroadcast = true,
  uploads,
  onTyping,
  onStopTyping,
}: {
  draftKey: string;
  placeholder: string;
  /** Called with the document; attachments (if any) are read from `uploads` by the caller. */
  onSend: (content: JSONContent) => void;
  /** When set, the toolbar offers "Send later"; called with the draft and the chosen time. */
  onSchedule?: (content: JSONContent, at: Date) => void;
  /** From useAttachmentUploads(); enables the attach button, paste and the pending list. */
  uploads?: ReturnType<typeof useAttachmentUploads>;
  /** Presence typing hooks (§7). */
  onTyping?: () => void;
  onStopTyping?: () => void;
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
  const typingRef = useRef({ onTyping, onStopTyping });
  typingRef.current = { onTyping, onStopTyping };
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
        class: "tiptap box-content min-h-[44px] max-h-64 caret-primary overflow-y-auto px-3.5 py-3 text-[14px] leading-[1.55] outline-none",
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
        // An open @mention or :emoji: list owns Enter (it picks the highlighted item).
        if ((view.dom as HTMLElement).dataset.suggestionOpen === "true") return false;
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
      if (isEmpty) typingRef.current.onStopTyping?.();
      else typingRef.current.onTyping?.();
    },
    onBlur() {
      typingRef.current.onStopTyping?.();
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
    typingRef.current.onStopTyping?.();
    editor.commands.clearContent(true);
    setDraft(draftKey, undefined);
    setEmpty(true);
  }
  submitRef.current = submit;

  // Two groups per the design: marks, then blocks. Attach/emoji/mention follow.
  const marks = editor
    ? [
        { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
      ]
    : [];
  const blocks = editor
    ? [
        { label: "Code", icon: Code, active: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
        { label: "Code block", icon: SquareCode, active: editor.isActive("codeBlock"), run: () => editor.chain().focus().toggleCodeBlock().run() },
        { label: "Bulleted list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
      ]
    : [];

  const renderTool = (t: { label: string; icon: typeof Bold; active: boolean; run: () => void }) => (
    <Tooltip key={t.label}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t.label}
          aria-pressed={t.active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={t.run}
          className={`${TOOL_BUTTON} ${t.active ? TOOL_ACTIVE : TOOL_IDLE}`}
        >
          <t.icon className="size-[15px]" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{t.label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="field-focus rounded-xl border border-border-input bg-bg-card shadow-xs transition-[border-color,box-shadow]">
      {uploads && (
        <PendingAttachments
          uploads={uploads.uploads}
          onRemove={uploads.remove}
          onRetry={(u) => {
            uploads.remove(u.id);
            uploads.addFiles([u.file]);
          }}
        />
      )}
      <EditorContent editor={editor} />
      <div className="flex items-center gap-0.5 border-t border-border-subtle px-2 py-1.5">
        {marks.map(renderTool)}
        <ToolDivider />
        {blocks.map(renderTool)}
        <ToolDivider />
        {uploads && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach files"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={`${TOOL_BUTTON} ${TOOL_IDLE}`}
                >
                  <Paperclip className="size-[15px]" aria-hidden="true" />
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
        <Tooltip>
          <EmojiPicker onPick={(e) => editor?.chain().focus().insertContent(`${e.native} `).run()}>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Add emoji" onMouseDown={(e) => e.preventDefault()} className={`${TOOL_BUTTON} ${TOOL_IDLE}`}>
                <SmilePlus className="size-[15px]" aria-hidden="true" />
              </button>
            </TooltipTrigger>
          </EmojiPicker>
          <TooltipContent side="top">Add emoji</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Mention someone"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().insertContent("@").run()}
              className={`${TOOL_BUTTON} ${TOOL_IDLE}`}
            >
              <AtSign className="size-[15px]" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Mention someone</TooltipContent>
        </Tooltip>

        <span className="ml-auto flex items-center gap-2">
          <span className={`items-center gap-[5px] text-[11.5px] text-muted-foreground ${compact ? "hidden" : "hidden sm:flex"}`}>
            <Kbd>Enter</Kbd> to send
          </span>
          {onSchedule && (
            <SendLaterMenu
              disabled={!canSend || Boolean(uploads?.uploads.length)}
              onPick={(at) => {
                const doc = editor?.getJSON();
                if (!doc || !editor) return;
                onSchedule(JSON.parse(JSON.stringify(doc)) as JSONContent, at);
                editor.commands.clearContent(true);
              }}
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Send message"
                disabled={!canSend}
                onClick={submit}
                className="grid size-[30px] place-items-center rounded-[7px] border border-accent-border bg-primary text-primary-foreground shadow-sm inset-shadow-2xs inset-shadow-white/20 transition-colors hover:border-accent-border-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-bg-subtle disabled:text-muted-foreground disabled:shadow-none disabled:inset-shadow-none"
              >
                <SendHorizontal className="size-[15px]" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Send</TooltipContent>
          </Tooltip>
        </span>
      </div>
    </div>
  );
}

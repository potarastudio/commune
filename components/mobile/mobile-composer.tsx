"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AtSign,
  Bold,
  Camera,
  Clock,
  Code,
  FileText,
  Image as ImageIcon,
  Italic,
  List,
  Pencil,
  Plus,
  SendHorizontal,
  SmilePlus,
  SquareCode,
  Strikethrough,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmojiSuggestion } from "@/lib/composer/emoji";
import { BROADCAST_ITEMS, createMentionExtension, type MentionItem } from "@/lib/composer/mentions";
import { useProfileMap, useProfiles } from "@/lib/queries/profiles";
import type { useAttachmentUploads } from "@/lib/queries/use-uploads";
import { useMobileEditStore } from "@/lib/store/mobile-edit";
import { useSessionStore } from "@/lib/store/session";
import { useUiStore } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import { attachmentLimitLabel, formatBytes } from "@/lib/utils/files";
import { sendLaterPresets } from "@/lib/utils/schedule";
import { isEmptyDoc } from "@/lib/utils/tiptap";
import { EmojiSheet } from "./emoji-sheet";
import { Sheet } from "./sheet";
import { TimeSheet } from "./time-sheet";

type Uploads = ReturnType<typeof useAttachmentUploads>;

/** A row in the attach sheet: 56px, a 36px tile, the label and what it takes. */
function AttachOption({
  icon,
  label,
  note,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  note?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[56px] w-full shrink-0 items-center gap-[14px] border-t border-border-subtle px-[18px] text-left text-[15px] font-medium text-ink active:bg-bg-hover"
    >
      <span className="grid size-[36px] shrink-0 place-items-center rounded-[10px] border border-border-subtle bg-bg-chip text-fg-600 [&>svg]:size-[17px]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {note && <span className="mt-[2px] block text-[12.5px] font-normal text-muted-foreground">{note}</span>}
      </span>
    </button>
  );
}

/**
 * Files staged above the field (design: Mobile Composer → Attachments): a
 * 78px tile each, with live progress and a per-item cancel, so a slow upload
 * never blocks the message.
 */
function StagedFiles({ uploads }: { uploads: Uploads }) {
  if (uploads.uploads.length === 0) return null;
  return (
    <ul className="flex gap-[8px] overflow-x-auto px-[2px] pb-[9px] [scrollbar-width:none]" aria-label="Files to send">
      {uploads.uploads.map((u) => {
        const failed = u.status === "error";
        const remove = (
          <button
            type="button"
            onClick={() => uploads.remove(u.id)}
            aria-label={u.status === "uploading" ? `Cancel upload of ${u.file.name}` : `Remove ${u.file.name}`}
            className="absolute top-0 right-0 grid size-[44px] place-items-start justify-items-end p-[5px]"
          >
            <span
              className={cn(
                "grid size-[22px] place-items-center rounded-full",
                u.previewUrl ? "bg-[rgba(10,10,10,0.7)] text-white" : "bg-bg-subtle text-fg-600",
              )}
            >
              <X className="size-[12px]" aria-hidden="true" />
            </span>
          </button>
        );
        if (u.previewUrl) {
          return (
            <li key={u.id} className="relative size-[78px] shrink-0 overflow-hidden rounded-[12px] border border-border bg-bg-chip">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
              <img src={u.previewUrl} alt="" className={cn("size-full object-cover", u.status === "uploading" && "opacity-70")} />
              {u.status === "uploading" && (
                <span className="absolute inset-x-[8px] bottom-[8px] block h-[4px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.5)]">
                  <span
                    className={cn("block h-[4px] rounded-full bg-primary", u.progress === undefined && "w-full animate-pulse")}
                    style={u.progress === undefined ? undefined : { width: `${Math.round(u.progress * 100)}%` }}
                  />
                </span>
              )}
              {failed && <span className="absolute inset-0 grid place-items-center bg-danger-surface text-[11px] font-semibold text-danger">Failed</span>}
              {remove}
            </li>
          );
        }
        return (
          <li
            key={u.id}
            className={cn(
              "relative flex h-[78px] max-w-[260px] shrink-0 items-center gap-[10px] overflow-hidden rounded-[12px] border py-0 pr-[34px] pl-[12px]",
              failed ? "border-danger bg-danger-surface" : "border-border bg-bg-card",
            )}
          >
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[10px] border border-border-subtle bg-bg-chip text-fg-600">
              <FileText className="size-[17px]" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">{u.file.name}</span>
              <span className={cn("mt-[2px] block text-[11.5px] tabular-nums", failed ? "font-semibold text-danger" : "text-muted-foreground")}>
                {failed ? (u.error ?? "Upload failed") : formatBytes(u.file.size)}
              </span>
              {u.status === "uploading" && (
                <span className="mt-[6px] block h-[4px] w-[104px] overflow-hidden rounded-full bg-bg-avatar">
                  <span
                    className={cn("block h-[4px] rounded-full bg-primary", u.progress === undefined && "w-full animate-pulse")}
                    style={u.progress === undefined ? undefined : { width: `${Math.round(u.progress * 100)}%` }}
                  />
                </span>
              )}
            </span>
            {remove}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The phone's composer (design: Mobile Composer): an attach button, a pill
 * field and a round send button that turns accent the moment there is
 * something to send. Return makes a new line — on a phone the send button is
 * the way to send. Formatting, files, the camera and "Send later" live behind
 * the + rather than in a permanent toolbar; nobody bolds text on a phone often
 * enough to spend 44px of chrome on it.
 */
export function MobileComposer({
  draftKey,
  placeholder,
  onSend,
  onSchedule,
  onSaveEdit,
  allowBroadcast = true,
  uploads,
  onTyping,
  onStopTyping,
  below,
}: {
  draftKey: string;
  placeholder: string;
  onSend: (content: JSONContent) => void;
  onSchedule?: (content: JSONContent, at: Date) => void;
  /** Saves the message being edited (see useMobileEditStore). */
  onSaveEdit?: (messageId: string, content: JSONContent) => void;
  allowBroadcast?: boolean;
  uploads?: Uploads;
  onTyping?: () => void;
  onStopTyping?: () => void;
  /** Under the field, inside the bar: the thread's "Also send to" line. */
  below?: React.ReactNode;
}) {
  const draft = useUiStore((s) => s.drafts[draftKey]);
  const setDraft = useUiStore((s) => s.setDraft);
  const editing = useMobileEditStore((s) => s.editing);
  const stopEditing = useMobileEditStore((s) => s.stop);
  const meId = useSessionStore((s) => s.meId);
  const timezone = useProfileMap().get(meId ?? "")?.timezone ?? "Asia/Jakarta";
  const [empty, setEmpty] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingRef = useRef({ onTyping, onStopTyping });
  typingRef.current = { onTyping, onStopTyping };
  const editingRef = useRef(editing);
  editingRef.current = editing;

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
        class: "tiptap max-h-[132px] min-h-[21px] overflow-y-auto text-[14.5px] leading-[1.45] text-body caret-primary outline-none",
        "aria-label": placeholder,
        role: "textbox",
        "aria-multiline": "true",
        enterkeyhint: "enter",
        autocapitalize: "sentences",
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0 || !uploads) return false;
        event.preventDefault();
        uploads.addFiles(files);
        return true;
      },
    },
    onUpdate({ editor }) {
      const doc = editor.getJSON();
      const isEmpty = isEmptyDoc(doc);
      setEmpty(isEmpty);
      // An edit is not a draft: it must not leak into the next message.
      if (!editingRef.current) setDraft(draftKey, isEmpty ? undefined : doc);
      if (isEmpty) typingRef.current.onStopTyping?.();
      else if (!editingRef.current) typingRef.current.onTyping?.();
    },
    onBlur() {
      typingRef.current.onStopTyping?.();
    },
  });

  useEffect(() => {
    if (editor) setEmpty(isEmptyDoc(editor.getJSON()));
  }, [editor]);

  // Starting an edit loads the message into the field; ending it puts the draft back.
  const editingId = editing?.messageId ?? null;
  useEffect(() => {
    if (!editor) return;
    if (editingRef.current) {
      editor.commands.setContent(editingRef.current.content);
      editor.commands.focus("end");
    } else {
      editor.commands.setContent(useUiStore.getState().drafts[draftKey] ?? "");
    }
    setEmpty(isEmptyDoc(editor.getJSON()));
  }, [editor, editingId, draftKey]);

  // Leaving the conversation mid-edit abandons the edit.
  useEffect(() => () => useMobileEditStore.getState().stop(), []);

  const hasFiles = (uploads?.uploads.length ?? 0) > 0;
  const uploading = uploads?.uploading ?? false;
  const canSend = Boolean(editing ? !empty : (!empty || (hasFiles && uploads?.ready.length)) && !uploading);

  const docNow = () => (editor ? (JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent) : null);

  const submit = () => {
    if (!editor || !canSend) return;
    const doc = docNow();
    if (!doc) return;
    if (editing) {
      onSaveEdit?.(editing.messageId, doc);
      stopEditing();
      return;
    }
    if (isEmptyDoc(doc) && !(uploads?.ready.length ?? 0)) return;
    onSend(doc);
    typingRef.current.onStopTyping?.();
    editor.commands.clearContent(true);
    setDraft(draftKey, undefined);
    setEmpty(true);
  };

  const pickFiles = (input: React.RefObject<HTMLInputElement | null>) => {
    setAttachOpen(false);
    // Let the sheet start leaving before the system picker covers it.
    setTimeout(() => input.current?.click(), 60);
  };

  const tools = editor
    ? [
        { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
        { label: "Code", icon: Code, active: editor.isActive("code"), run: () => editor.chain().focus().toggleCode().run() },
        { label: "Code block", icon: SquareCode, active: editor.isActive("codeBlock"), run: () => editor.chain().focus().toggleCodeBlock().run() },
        { label: "Bulleted list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
        { label: "Mention someone", icon: AtSign, active: false, run: () => editor.chain().focus().insertContent("@").run() },
        { label: "Emoji", icon: SmilePlus, active: false, run: () => setEmojiOpen(true) },
      ]
    : [];

  return (
    <div data-mobile-composer="" className="shrink-0 border-t border-border bg-bg-main px-[8px] pt-[8px] pb-[calc(10px+var(--safe-bottom))]">
      {editing && (
        <div className="flex items-center gap-[9px] px-[4px] pb-[9px]">
          <Pencil className="size-[14px] shrink-0 text-accent-text" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-accent-text">Editing message</span>
          <button
            type="button"
            onClick={stopEditing}
            className="flex h-[44px] shrink-0 items-center rounded-[11px] px-[12px] text-[12.5px] font-semibold text-muted-foreground active:bg-bg-subtle"
          >
            Cancel
          </button>
        </div>
      )}
      {uploads && !editing && <StagedFiles uploads={uploads} />}
      {formatting && (
        <div role="toolbar" aria-label="Formatting" className="flex items-center gap-[2px] overflow-x-auto px-[2px] pb-[8px] [scrollbar-width:none]">
          {tools.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-label={t.label}
              aria-pressed={t.active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
              className={cn(
                "grid size-[40px] shrink-0 place-items-center rounded-[10px]",
                t.active ? "bg-bg-subtle text-ink" : "text-fg-600 active:bg-bg-subtle",
              )}
            >
              <t.icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFormatting(false)}
            className="ml-auto flex h-[40px] shrink-0 items-center rounded-[10px] px-[12px] text-[13px] font-semibold text-muted-foreground active:bg-bg-subtle"
          >
            Done
          </button>
        </div>
      )}
      <div className="flex items-end gap-[6px]">
        <button
          type="button"
          aria-label={attachOpen ? "Close" : "Add to message"}
          aria-expanded={attachOpen}
          onClick={() => setAttachOpen((o) => !o)}
          className={cn(
            "grid size-[44px] shrink-0 place-items-center rounded-[10px] active:bg-bg-subtle",
            attachOpen ? "text-primary" : "text-fg-600",
          )}
        >
          {attachOpen ? <X className="size-[21px]" strokeWidth={1.75} aria-hidden="true" /> : <Plus className="size-[21px]" strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <div
          onClick={() => editor?.commands.focus()}
          className="flex min-h-[44px] min-w-0 flex-1 cursor-text items-center rounded-[22px] border border-border-input bg-bg-card px-[15px] py-[10px] transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--accent-surface)]"
        >
          <EditorContent editor={editor} className="min-w-0 flex-1" />
        </div>
        <button
          type="button"
          aria-label={editing ? "Save edit" : "Send"}
          disabled={!canSend}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="grid size-[44px] shrink-0 place-items-center rounded-full border border-accent-border bg-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] disabled:border-border-strong disabled:bg-bg-subtle disabled:text-muted-foreground disabled:shadow-none"
        >
          <SendHorizontal className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {below}

      {uploads && (
        <>
          <input
            ref={photoInput}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length) uploads.addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length) uploads.addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileInput}
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

      <Sheet open={attachOpen} onOpenChange={setAttachOpen} title="Add to message">
        <div className="min-h-0 overflow-y-auto">
          {uploads && !editing && (
            <>
              <AttachOption icon={<ImageIcon />} label="Photo or video" note="From your library" onSelect={() => pickFiles(photoInput)} />
              <AttachOption icon={<Camera />} label="Take a photo" onSelect={() => pickFiles(cameraInput)} />
              <AttachOption icon={<FileText />} label="File" note={`PDF, docs, anything up to ${attachmentLimitLabel()}`} onSelect={() => pickFiles(fileInput)} />
            </>
          )}
          <AttachOption
            icon={<Bold />}
            label="Formatting"
            note="Bold, italic, code, lists"
            onSelect={() => {
              setAttachOpen(false);
              setFormatting(true);
              editor?.commands.focus();
            }}
          />
          {onSchedule && !editing && (
            <AttachOption
              icon={<Clock />}
              label="Send later"
              note={empty ? "Write the message first" : undefined}
              onSelect={() => {
                setAttachOpen(false);
                if (!empty && !hasFiles) setLaterOpen(true);
              }}
            />
          )}
        </div>
      </Sheet>

      <EmojiSheet open={emojiOpen} onOpenChange={setEmojiOpen} title="Add emoji" onPick={(emoji) => editor?.chain().focus().insertContent(`${emoji} `).run()} />

      {onSchedule && (
        <TimeSheet
          open={laterOpen}
          onOpenChange={setLaterOpen}
          title="Send later"
          presets={laterOpen ? sendLaterPresets(new Date(), timezone) : []}
          timezone={timezone}
          onPick={(at) => {
            const doc = docNow();
            setLaterOpen(false);
            if (!doc || !editor) return;
            onSchedule(doc, at);
            editor.commands.clearContent(true);
            setDraft(draftKey, undefined);
            setEmpty(true);
          }}
        />
      )}
    </div>
  );
}

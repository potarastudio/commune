"use client";

import { AlarmClock, Bookmark, BookmarkCheck, Copy, Link2, MessageSquareText, Pencil, Pin, PinOff, SmilePlus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Emoji } from "@/components/emoji/emoji";
import { createReminderAction } from "@/lib/actions/scheduling";
import type { Message } from "@/lib/queries/messages";
import { useProfileMap } from "@/lib/queries/profiles";
import { renderContent } from "@/lib/utils/render";
import { describeWhen, reminderPresets } from "@/lib/utils/schedule";
import { formatMessageTime } from "@/lib/utils/time";
import { useViewerTimezone } from "@/lib/viewer-timezone";
import { EmojiSheet } from "./emoji-sheet";
import { Sheet, SheetAction } from "./sheet";
import { TimeSheet } from "./time-sheet";

const QUICK_REACTIONS = ["🔥", "👍", "❤️", "😂", "👀"];

/** Where a message lives, as a link that opens it — the thread for a reply. */
export function messageLink(m: Pick<Message, "id" | "channel_id" | "conversation_id" | "parent_id">): string {
  const base = m.channel_id ? `/channel/${m.channel_id}` : `/dm/${m.conversation_id}`;
  return `${window.location.origin}${base}?${m.parent_id ? `thread=${m.parent_id}` : `message=${m.id}`}`;
}

/**
 * Long-press on a message (design: Mobile Touch → Long-press message). The
 * message lifts clear of the scrim so you can see what you are acting on;
 * reactions sit above it, thumb-side; the actions below read top to bottom,
 * and the only irreversible one sits last and red — and asks twice.
 */
export function MessageSheet({
  open,
  onOpenChange,
  message,
  meId,
  canEdit,
  canDelete,
  isChannel,
  onReact,
  onReply,
  onToggleSave,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message;
  meId: string;
  canEdit: boolean;
  canDelete: boolean;
  isChannel: boolean;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onToggleSave: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tz = useViewerTimezone();
  const timezone = useProfileMap().get(meId)?.timezone ?? tz;
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminding, startReminder] = useTransition();
  const name = message.author?.display_name ?? "Someone";

  const close = () => {
    setConfirmDelete(false);
    onOpenChange(false);
  };
  const then = (fn: () => void) => () => {
    close();
    fn();
  };

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Couldn't copy that");
    }
  };

  const remind = (at: Date) =>
    startReminder(async () => {
      const result = await createReminderAction({ messageId: message.id, remindAt: at.toISOString() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRemindOpen(false);
      toast.success(`Reminder set for ${describeWhen(at, timezone)}`);
    });

  const above = (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-[6px] rounded-[16px] border border-border bg-bg-card px-[9px] py-[7px] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            onClick={then(() => onReact(emoji))}
            className="grid size-[44px] place-items-center rounded-[12px] text-[23px] leading-none active:bg-bg-subtle"
          >
            <Emoji value={emoji} />
          </button>
        ))}
        <button
          type="button"
          aria-label="More reactions"
          onClick={() => setEmojiOpen(true)}
          className="grid size-[44px] place-items-center rounded-[12px] border border-border-strong bg-bg-chip text-fg-600 active:bg-bg-subtle"
        >
          <SmilePlus className="size-[19px]" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-[11px] rounded-[14px] border border-border bg-bg-card px-[13px] py-[11px] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.45)]">
        <div className="flex gap-[10px]">
          <span className="grid size-[32px] shrink-0 place-items-center overflow-hidden rounded-[9px] bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]">
            {message.author?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatars come from storage and Google, sized by CSS
              <img src={message.author.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[12px] font-semibold text-fg-600">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-[7px]">
              <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
              <time className="shrink-0 text-[11.5px] text-muted-foreground tabular-nums">{formatMessageTime(message.created_at, tz)}</time>
            </div>
            <div className="mt-px line-clamp-5 text-[14px] leading-[1.5] text-body [&>p+p]:mt-1">
              {renderContent(message.content as Parameters<typeof renderContent>[0], { inert: true })}
              {!message.content_text && message.attachments.length > 0 && (
                <span className="text-muted-foreground">
                  {message.attachments.length === 1 ? "1 file" : `${message.attachments.length} files`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(false);
          onOpenChange(next);
        }}
        title="Message actions"
        above={above}
      >
        <div className="min-h-0 overflow-y-auto">
          {onReply && (
            <SheetAction icon={<MessageSquareText />} onSelect={then(onReply)}>
              Reply in thread
            </SheetAction>
          )}
          {canEdit && (
            <SheetAction icon={<Pencil />} onSelect={then(onEdit)}>
              Edit message
            </SheetAction>
          )}
          <SheetAction icon={message.is_saved ? <BookmarkCheck /> : <Bookmark />} onSelect={then(onToggleSave)}>
            {message.is_saved ? "Remove from Saved" : "Save for later"}
          </SheetAction>
          <SheetAction icon={message.is_pinned ? <PinOff /> : <Pin />} onSelect={then(onTogglePin)}>
            {message.is_pinned ? "Unpin" : isChannel ? "Pin to channel" : "Pin to conversation"}
          </SheetAction>
          <SheetAction
            icon={<AlarmClock />}
            onSelect={() => {
              close();
              setRemindOpen(true);
            }}
          >
            Remind me
          </SheetAction>
          <SheetAction icon={<Copy />} onSelect={then(() => void copy(message.content_text, "Text copied"))} disabled={!message.content_text}>
            Copy text
          </SheetAction>
          <SheetAction icon={<Link2 />} onSelect={then(() => void copy(messageLink(message), "Link copied"))}>
            Copy link
          </SheetAction>
          {canDelete && (
            <SheetAction
              icon={<Trash2 />}
              tone="danger"
              onSelect={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                close();
                onDelete();
              }}
            >
              {confirmDelete ? "Tap again to delete" : "Delete message"}
            </SheetAction>
          )}
        </div>
      </Sheet>

      <EmojiSheet
        open={emojiOpen}
        onOpenChange={setEmojiOpen}
        onPick={(emoji) => {
          close();
          onReact(emoji);
        }}
      />

      <TimeSheet
        open={remindOpen}
        onOpenChange={setRemindOpen}
        title="Remind me"
        presets={remindOpen ? reminderPresets(new Date(), timezone) : []}
        timezone={timezone}
        pending={reminding}
        onPick={remind}
      />
    </>
  );
}

"use client";

import { AlertCircle, Bookmark, MessageSquareText, Pin } from "lucide-react";
import { useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileCard } from "@/components/profile/profile-card";
import { EditHistory } from "./edit-history";
import { UserStatus } from "@/components/profile/user-status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Message } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";
import { renderContent } from "@/lib/utils/render";
import { extractLinks, extractMentions } from "@/lib/utils/tiptap";
import { formatFullTimestamp, formatMessageTime } from "@/lib/utils/time";
import { AttachmentList } from "./attachment-list";
import { LinkPreviews } from "./link-previews";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { ReactionBar } from "./reaction-bar";
import { useViewerTimezone } from "@/lib/viewer-timezone";
import { MobileAttachments } from "@/components/mobile/media";
import { MessageSheet } from "@/components/mobile/message-sheet";
import { MobileLink } from "@/components/mobile/mobile-link";
import { useRowGestures } from "@/components/mobile/use-row-gestures";
import { useIsMobile } from "@/lib/mobile-context";
import { useMobileEditStore } from "@/lib/store/mobile-edit";

export function MessageItem({
  message,
  grouped,
  meId,
  canDelete,
  onToggleReaction,
  onDelete,
  onReply,
  onEdit,
  onTogglePin,
  onToggleSave,
  onRetry,
  onDiscard,
  allowBroadcast = true,
  replySummary,
  inThread = false,
}: {
  message: Message;
  grouped: boolean;
  meId: string;
  canDelete: boolean;
  onToggleReaction: (emoji: string, active: boolean) => void;
  onDelete: () => void;
  onReply?: () => void;
  onEdit: (content: JSONContent) => void;
  onTogglePin: (pinned: boolean) => void;
  onToggleSave: (saved: boolean) => void;
  /** Failed send: re-run it. Absent when the container has no retry path. */
  onRetry?: () => void;
  /** Failed send: drop the unsent draft row. */
  onDiscard?: () => void;
  allowBroadcast?: boolean;
  replySummary?: React.ReactNode;
  inThread?: boolean;
}) {
  const tz = useViewerTimezone();
  const [editing, setEditing] = useState(false);
  const author = message.author;
  const name = author?.display_name ?? "Unknown";
  const deleted = message.deleted_at !== null;
  const time = formatMessageTime(message.created_at, tz);
  const isMine = message.author_id === meId;
  // The phone has no hover: a long-press opens the actions, a swipe right replies,
  // and editing happens in the composer rather than in the row.
  const mobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Mounted from the first long-press on, so the sheet can animate out and hand over to its own sub-sheets.
  const [sheetMounted, setSheetMounted] = useState(false);
  const editingOnPhone = useMobileEditStore((s) => mobile && s.editing?.messageId === message.id);
  const startPhoneEdit = useMobileEditStore((s) => s.start);
  const gestures = useRowGestures({
    enabled: mobile && !message.pending && !message.failed && message.deleted_at === null,
    onLongPress: () => {
      setSheetMounted(true);
      setSheetOpen(true);
    },
    onSwipe: !inThread && onReply ? onReply : undefined,
  });

  // A direct @you tints the row with the accent (design decision 1: mentions are orange).
  const content = message.content as JSONContent;
  const mentionsMe = useMemo(
    () => !isMine && extractMentions(content).some((m) => m.kind === "user" && m.userId === meId),
    [content, isMine, meId],
  );

  const pinned = message.is_pinned && !deleted;
  const failed = Boolean(message.failed);
  // One ground per row: failed beats a mention, a mention beats pinned.
  const tinted = failed || (mentionsMe && !deleted) || pinned;

  if (deleted) {
    return (
      <article
        id={`message-${message.id}`}
        className={cn("relative flex", mobile ? "gap-[10px] px-[16px] py-[7px]" : "gap-3 px-4 py-1.5 md:px-6")}
        aria-label="Deleted message"
      >
        <div className={mobile ? "w-[32px] shrink-0" : "w-9 shrink-0"}>
          <span
            aria-hidden="true"
            className={cn(
              "grid place-items-center border border-dashed border-border-input bg-bg-hover",
              mobile ? "size-[32px] rounded-[9px]" : "size-9 rounded-[10px]",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center", mobile ? "min-h-[32px]" : "min-h-9")}>
            <p className="text-[13.5px] italic text-muted-foreground">This message was deleted</p>
          </div>
          {/* A soft-deleted parent keeps its thread reachable — the replies survive the delete. */}
          {!inThread && replySummary}
        </div>
      </article>
    );
  }

  const row = (
    <article
      id={`message-${message.id}`}
      {...gestures.handlers}
      data-long-press={mobile ? "" : undefined}
      className={cn(
        "group relative flex",
        mobile ? "touch-pan-y gap-[10px] px-[16px]" : "gap-3 px-4 md:px-6",
        mobile ? (grouped ? "py-[2px]" : "py-[7px]") : grouped ? "py-0.5" : "py-1.5",
        !mobile && !tinted && !editing && "hover:bg-bg-hover",
        message.pending && "opacity-70",
        failed && !mobile && "bg-danger-surface",
        !failed && (mentionsMe || editingOnPhone) && "bg-accent-surface",
        !failed && !mentionsMe && !editingOnPhone && pinned && "bg-bg-pinned",
        sheetOpen && "bg-bg-hover",
      )}
      style={
        mobile && gestures.swiping
          ? { transform: `translateX(${gestures.offset}px)`, boxShadow: "-6px 0 12px -6px var(--shadow-tint-lg)" }
          : mobile
            ? { transition: "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)" }
            : undefined
      }
      aria-label={`${name} at ${time}`}
    >
      {((failed && !mobile) || mentionsMe) && (
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", failed ? "bg-danger" : "bg-primary")} />
      )}

      <div className={mobile ? "w-[32px] shrink-0" : "w-9 shrink-0"}>
        {grouped ? (
          !mobile && <span className="mt-[3px] hidden w-9 pr-1 text-right text-[11px] tabular-nums text-tertiary group-hover:block">{time}</span>
        ) : mobile ? (
          <MobileLink
            href={author ? `/u/${author.handle}` : "#"}
            aria-label={`${name}'s profile`}
            className="grid size-[32px] place-items-center overflow-hidden rounded-[9px] bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]"
          >
            {author?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatars come from storage and Google, sized by CSS
              <img src={author.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[12px] font-semibold text-fg-600">{name.slice(0, 1).toUpperCase()}</span>
            )}
          </MobileLink>
        ) : (
          <ProfileCard userId={author?.id ?? ""}>
            <button type="button" aria-label={`${name}'s profile`} className="block rounded-[10px]">
              <Avatar size="lg">
                <AvatarImage src={author?.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
          </ProfileCard>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {(message.is_pinned || message.is_saved) && (
          <p className="mb-[3px] flex items-center gap-3 text-[11.5px] font-semibold tracking-[0.01em]">
            {message.is_pinned && (
              <span className="flex items-center gap-1.5 text-accent-foreground">
                <Pin className="size-3" aria-hidden="true" /> Pinned
              </span>
            )}
            {message.is_saved && (
              <span className="flex items-center gap-1.5 text-fg-600">
                <Bookmark className="size-3" aria-hidden="true" /> Saved for later
              </span>
            )}
          </p>
        )}
        {!grouped && mobile && (
          <div className="flex items-baseline gap-[7px]">
            <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">{name}</span>
            {editingOnPhone ? (
              <span className="shrink-0 rounded-[5px] border border-accent-surface-border bg-bg-card px-[5px] text-[10px] font-semibold text-accent-foreground">
                EDITING
              </span>
            ) : (
              isMine && (
                <span className="shrink-0 rounded-[5px] border border-border-strong bg-bg-chip px-[5px] text-[10px] font-semibold text-fg-600">YOU</span>
              )
            )}
            {author && <UserStatus userId={author.id} className="self-center" />}
            <time dateTime={message.created_at} className="shrink-0 text-[11.5px] text-muted-foreground tabular-nums">
              {time}
            </time>
          </div>
        )}
        {!grouped && !mobile && (
          <div className="flex items-baseline gap-2">
            <ProfileCard userId={author?.id ?? ""}>
              <button
                type="button"
                className="rounded-sm text-[14px] font-semibold tracking-[-0.005em] text-ink hover:underline"
              >
                {name}
              </button>
            </ProfileCard>
            {isMine && (
              <span className="rounded-[5px] border border-border-strong bg-bg-chip px-[5px] text-[10.5px] font-semibold tracking-[0.02em] text-fg-600">
                YOU
              </span>
            )}
            {author && <UserStatus userId={author.id} className="self-center" />}
            <Tooltip>
              <TooltipTrigger asChild>
                <time dateTime={message.created_at} className="text-[12px] tabular-nums text-muted-foreground">
                  {time}
                </time>
              </TooltipTrigger>
              <TooltipContent side="top">{formatFullTimestamp(message.created_at, tz)}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {editing ? (
          <MessageEditor
            content={content}
            allowBroadcast={allowBroadcast}
            onCancel={() => setEditing(false)}
            onSave={(doc) => {
              setEditing(false);
              onEdit(doc);
            }}
          />
        ) : (
          <div
            className={cn(
              "text-[14px] text-body [&>p+p]:mt-1 [&>p:last-of-type]:inline [&>p:last-of-type]:after:content-['']",
              mobile ? "leading-[1.5] [text-wrap:pretty]" : "leading-[1.55]",
              editingOnPhone && "text-fg-600",
              mobile && failed && "text-muted-foreground",
              !grouped && "mt-px",
            )}
          >
            {renderContent(content as Parameters<typeof renderContent>[0])}
            {message.is_edited && <EditHistory messageId={message.id} editedAt={message.edited_at} />}
          </div>
        )}

        {message.pending && !editing && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span
              aria-hidden="true"
              className="commune-spin block size-[11px] rounded-full border-[1.5px] border-border-hover border-t-primary"
            />
            Sending…
          </p>
        )}

        {failed && !editing && mobile && (
          <div className="mt-[8px] flex flex-wrap items-center gap-[8px] rounded-[11px] border border-danger bg-danger-surface px-[11px] py-[10px]">
            <span className="flex min-w-0 flex-1 items-center gap-[8px] text-[12.5px] font-semibold text-danger">
              <AlertCircle className="size-[15px] shrink-0" aria-hidden="true" />
              {typeof navigator !== "undefined" && !navigator.onLine ? "Couldn’t send — you’re offline" : "Couldn’t send"}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex h-[44px] shrink-0 items-center rounded-[11px] border border-danger bg-bg-card px-[16px] text-[12.5px] font-semibold text-danger"
              >
                Retry
              </button>
            )}
            {onDiscard && (
              <button
                type="button"
                onClick={onDiscard}
                className="flex h-[44px] shrink-0 items-center rounded-[11px] px-[14px] text-[12.5px] font-semibold text-muted-foreground"
              >
                Delete
              </button>
            )}
          </div>
        )}
        {failed && !editing && !mobile && (
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <p className="text-[12.5px] font-semibold text-danger">Couldn&rsquo;t send — it stays here so you can copy it.</p>
            {(onRetry || onDiscard) && (
              <span className="flex items-center gap-1.5">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex h-7 items-center rounded-[7px] border border-border-strong bg-bg-card px-2.5 text-[12.5px] font-semibold text-ink hover:border-border-hover hover:bg-bg-card-hover"
                  >
                    Try again
                  </button>
                )}
                {onDiscard && (
                  <button
                    type="button"
                    onClick={onDiscard}
                    className="flex h-7 items-center rounded-[7px] px-2 text-[12.5px] font-semibold text-muted-foreground hover:text-danger"
                  >
                    Discard
                  </button>
                )}
              </span>
            )}
          </div>
        )}

        {mobile ? (
          <MobileAttachments
            attachments={message.attachments}
            actions={{
              author: name,
              time,
              onReact: (emoji) => onToggleReaction(emoji, message.reactions.some((r) => r.emoji === emoji && r.user_id === meId)),
              onReply: inThread ? undefined : onReply,
              onDelete: canDelete ? onDelete : undefined,
            }}
          />
        ) : (
          <AttachmentList attachments={message.attachments} />
        )}
        {!message.pending && !editing && <LinkPreviews urls={extractLinks(content, 2)} />}
        <ReactionBar reactions={message.reactions} meId={meId} onToggle={onToggleReaction} />
        {!inThread && replySummary}
      </div>

      {mobile && sheetMounted && (
        <MessageSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          message={message}
          meId={meId}
          canEdit={isMine}
          canDelete={canDelete}
          isChannel={message.channel_id !== null}
          onReact={(emoji) => onToggleReaction(emoji, message.reactions.some((r) => r.emoji === emoji && r.user_id === meId))}
          onReply={inThread ? undefined : onReply}
          onToggleSave={() => onToggleSave(!message.is_saved)}
          onTogglePin={() => onTogglePin(!message.is_pinned)}
          onEdit={() => startPhoneEdit(message.id, content)}
          onDelete={onDelete}
        />
      )}
      {!mobile && !message.pending && !failed && !editing && (
        <MessageActions
          messageId={message.id}
          canDelete={canDelete}
          canEdit={isMine}
          isPinned={message.is_pinned}
          isSaved={message.is_saved}
          onEdit={() => setEditing(true)}
          onTogglePin={() => onTogglePin(!message.is_pinned)}
          onToggleSave={() => onToggleSave(!message.is_saved)}
          onReact={(emoji) =>
            onToggleReaction(emoji, message.reactions.some((r) => r.emoji === emoji && r.user_id === meId))
          }
          onDelete={onDelete}
          onReply={inThread ? undefined : onReply}
        />
      )}
    </article>
  );

  if (!mobile) return row;
  // Swipe right to reply (design: Mobile Touch → Swipe to reply): the row slides over the
  // reply icon, which is there before you commit and turns accent when you have.
  return (
    <div className="relative overflow-hidden">
      {gestures.swiping && (
        <span aria-hidden="true" className="absolute inset-y-0 left-[14px] flex items-center" style={{ opacity: Math.min(1, gestures.offset / 40) }}>
          <span
            className={cn(
              "grid size-[38px] place-items-center rounded-full shadow-[0_2px_8px_-2px_var(--shadow-tint-lg)] transition-colors",
              gestures.committed ? "bg-primary text-white" : "bg-bg-subtle text-fg-600",
            )}
          >
            <MessageSquareText className="size-[18px]" />
          </span>
        </span>
      )}
      {row}
    </div>
  );
}

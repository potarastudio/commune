"use client";

import { Bookmark, Pin } from "lucide-react";
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
      <article id={`message-${message.id}`} className="relative flex gap-3 px-4 py-1.5 md:px-6" aria-label="Deleted message">
        <div className="w-9 shrink-0">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-[10px] border border-dashed border-border-input bg-bg-hover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-9 items-center">
            <p className="text-[13.5px] italic text-muted-foreground">This message was deleted</p>
          </div>
          {/* A soft-deleted parent keeps its thread reachable — the replies survive the delete. */}
          {!inThread && replySummary}
        </div>
      </article>
    );
  }

  return (
    <article
      id={`message-${message.id}`}
      className={cn(
        "group relative flex gap-3 px-4 md:px-6",
        grouped ? "py-0.5" : "py-1.5",
        !tinted && !editing && "hover:bg-bg-hover",
        message.pending && "opacity-70",
        failed && "bg-danger-surface",
        !failed && mentionsMe && "bg-accent-surface",
        !failed && !mentionsMe && pinned && "bg-bg-pinned",
      )}
      aria-label={`${name} at ${time}`}
    >
      {(failed || mentionsMe) && (
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", failed ? "bg-danger" : "bg-primary")} />
      )}

      <div className="w-9 shrink-0">
        {grouped ? (
          <span className="mt-[3px] hidden w-9 pr-1 text-right text-[11px] tabular-nums text-tertiary group-hover:block">{time}</span>
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
        {!grouped && (
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
              "text-[14px] leading-[1.55] text-body [&>p+p]:mt-1 [&>p:last-of-type]:inline [&>p:last-of-type]:after:content-['']",
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

        {failed && !editing && (
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

        <AttachmentList attachments={message.attachments} />
        {!message.pending && !editing && <LinkPreviews urls={extractLinks(content, 2)} />}
        <ReactionBar reactions={message.reactions} meId={meId} onToggle={onToggleReaction} />
        {!inThread && replySummary}
      </div>

      {!message.pending && !failed && !editing && (
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
}

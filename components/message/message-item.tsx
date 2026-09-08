"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Message } from "@/lib/queries/messages";
import { renderContent } from "@/lib/utils/render";
import { formatFullTimestamp, formatMessageTime } from "@/lib/utils/time";
import { MessageActions } from "./message-actions";
import { ReactionBar } from "./reaction-bar";

export function MessageItem({
  message,
  grouped,
  meId,
  canDelete,
  onToggleReaction,
  onDelete,
}: {
  message: Message;
  grouped: boolean;
  meId: string;
  canDelete: boolean;
  onToggleReaction: (emoji: string, active: boolean) => void;
  onDelete: () => void;
}) {
  const author = message.author;
  const name = author?.display_name ?? "Unknown";
  const deleted = message.deleted_at !== null;
  const time = formatMessageTime(message.created_at);

  return (
    <article
      id={`message-${message.id}`}
      className={`group relative flex gap-3 px-5 hover:bg-message-hover ${grouped ? "py-0.5" : "mt-2 py-1"} ${
        message.pending ? "opacity-60" : ""
      } ${message.failed ? "bg-destructive/5" : ""}`}
      aria-label={`${name} at ${time}`}
    >
      <div className="w-9 shrink-0">
        {grouped ? (
          <span className="mt-1 hidden text-[11px] tabular-nums text-muted-foreground group-hover:block">{time}</span>
        ) : (
          <Avatar className="size-9 rounded-md">
            <AvatarImage src={author?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="rounded-md bg-accent text-[13px] font-semibold text-accent-foreground">
              {name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="min-w-0 flex-1 leading-[1.5]">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold">{name}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <time dateTime={message.created_at} className="text-[11px] tabular-nums text-muted-foreground">
                  {time}
                </time>
              </TooltipTrigger>
              <TooltipContent side="top">{formatFullTimestamp(message.created_at)}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {deleted ? (
          <p className="italic text-muted-foreground">This message was deleted</p>
        ) : (
          <div className="text-[14px] [&>p+p]:mt-1 [&>p:last-of-type]:inline [&>p:last-of-type]:after:content-['']">
            {renderContent(message.content as Parameters<typeof renderContent>[0])}
            {message.is_edited && (
              <span className="ml-1 align-baseline text-[11px] text-muted-foreground">(edited)</span>
            )}
            {message.failed && <span className="ml-1 align-baseline text-[11px] text-destructive">Not sent</span>}
          </div>
        )}

        {!deleted && <ReactionBar reactions={message.reactions} meId={meId} onToggle={onToggleReaction} />}
      </div>

      {!deleted && !message.pending && !message.failed && (
        <MessageActions
          messageId={message.id}
          canDelete={canDelete}
          onReact={(emoji) =>
            onToggleReaction(emoji, message.reactions.some((r) => r.emoji === emoji && r.user_id === meId))
          }
          onDelete={onDelete}
        />
      )}
    </article>
  );
}

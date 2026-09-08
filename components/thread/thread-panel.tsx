"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { MessageComposer } from "@/components/message/message-composer";
import { MessageItem } from "@/components/message/message-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { messageKeys, type Container, type MessageAuthor } from "@/lib/queries/messages";
import { useDeleteMessage, useSendReply, useThread, useToggleReaction } from "@/lib/queries/use-messages";
import { shouldGroup } from "@/lib/utils/time";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** Right-hand thread panel (§6: 400px). Opened via ?thread=<id>, closed with the X or Esc. */
export function ThreadPanel({
  parentId,
  container,
  containerLabel,
  me,
  isAdmin,
  canPost,
}: {
  parentId: string;
  container: Container;
  containerLabel: string;
  me: MessageAuthor;
  isAdmin: boolean;
  canPost: boolean;
}) {
  const { closeThread } = useThreadNav();
  const { data: thread, isPending, isError } = useThread(parentId);
  const keys = [messageKeys.container(container), messageKeys.thread(parentId)];
  const sendReply = useSendReply(container, parentId, me);
  const toggleReaction = useToggleReaction(keys, me.id);
  const del = useDeleteMessage(keys);
  const [alsoSend, setAlsoSend] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest(".tiptap"))) closeThread();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeThread]);

  const handleSend = useCallback(
    (content: JSONContent) => {
      sendReply.mutate({ content, tempId: `temp-${crypto.randomUUID()}`, alsoSendToContainer: alsoSend });
      setAlsoSend(false);
    },
    [sendReply, alsoSend],
  );

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-border bg-background" aria-label="Thread">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Thread</h2>
        <span className="min-w-0 truncate text-[13px] text-muted-foreground">{containerLabel}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={closeThread}
              aria-label="Close thread"
              className="ml-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close (Esc)</TooltipContent>
        </Tooltip>
      </header>

      <div className="flex-1 overflow-y-auto py-2" role="log" aria-label="Thread replies">
        {isPending && (
          <div className="space-y-3 px-5 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}
        {(isError || (!isPending && !thread)) && (
          <p className="px-5 py-6 text-[13px] text-muted-foreground">This thread isn&apos;t available. It may have been deleted.</p>
        )}
        {thread && (
          <>
            <MessageItem
              message={thread.parent}
              grouped={false}
              meId={me.id}
              canDelete={thread.parent.author_id === me.id || isAdmin}
              onToggleReaction={(emoji, active) => toggleReaction.mutate({ messageId: thread.parent.id, emoji, active })}
              onDelete={() => del.mutate(thread.parent.id)}
              inThread
            />
            {thread.replies.length > 0 && (
              <div className="my-2 flex items-center gap-3 px-5 text-[12px] text-muted-foreground">
                <span>
                  {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
                </span>
                <span className="h-px flex-1 bg-divider" />
              </div>
            )}
            {thread.replies.map((m, i) => (
              <MessageItem
                key={m.id}
                message={m}
                grouped={shouldGroup(thread.replies[i - 1], m) && !m.deleted_at}
                meId={me.id}
                canDelete={m.author_id === me.id || isAdmin}
                onToggleReaction={(emoji, active) => toggleReaction.mutate({ messageId: m.id, emoji, active })}
                onDelete={() => del.mutate(m.id)}
                inThread
              />
            ))}
          </>
        )}
      </div>

      {canPost && thread && !thread.parent.deleted_at && (
        <div className="shrink-0 px-4 pb-4 pt-1">
          <MessageComposer
            draftKey={`thread:${parentId}`}
            placeholder="Reply…"
            onSend={handleSend}
            compact
            allowBroadcast={container.kind === "channel"}
          />
          <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={alsoSend}
              onChange={(e) => setAlsoSend(e.target.checked)}
              className="size-3.5 accent-[var(--primary)]"
            />
            Also send to {containerLabel}
          </label>
        </div>
      )}
    </aside>
  );
}

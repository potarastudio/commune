"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { MessageComposer } from "@/components/message/message-composer";
import { MessageItem } from "@/components/message/message-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { messageKeys, type Container, type MessageAuthor } from "@/lib/queries/messages";
import {
  useDeleteMessage,
  useEditMessage,
  useSendReply,
  useThread,
  useTogglePin,
  useToggleReaction,
  useToggleSave,
} from "@/lib/queries/use-messages";
import { useAttachmentUploads } from "@/lib/queries/use-uploads";
import { shouldGroup } from "@/lib/utils/time";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** Right-hand thread panel: the design's 380px column. Opened via ?thread=<id>, closed with the X or Esc. */
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
  const edit = useEditMessage(keys);
  const pin = useTogglePin(keys);
  const save = useToggleSave(keys);
  const [alsoSend, setAlsoSend] = useState(false);
  const uploads = useAttachmentUploads();
  const isChannel = container.kind === "channel";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest(".tiptap"))) closeThread();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeThread]);

  const handleSend = useCallback(
    (content: JSONContent) => {
      sendReply.mutate({
        content,
        tempId: `temp-${crypto.randomUUID()}`,
        alsoSendToContainer: alsoSend,
        attachments: uploads.ready,
        previews: uploads.uploads,
      });
      uploads.clear();
      setAlsoSend(false);
    },
    [sendReply, alsoSend, uploads],
  );

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-border bg-bg-main" aria-label="Thread">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border pr-3 pl-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.015em] text-ink">Thread</span>
          <span className="block truncate text-[12px] text-muted-foreground">{containerLabel}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={closeThread}
              aria-label="Close thread"
              className="grid size-[30px] shrink-0 place-items-center rounded-[7px] text-fg-600 hover:bg-bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close (Esc)</TooltipContent>
        </Tooltip>
      </header>

      <div className="flex-1 overflow-y-auto [&_article]:px-4" role="log" aria-label="Thread replies">
        {isPending && (
          <div className="px-4 py-3.5" aria-label="Loading thread">
            <div className="flex gap-3 border-b border-border pb-3.5">
              <Skeleton className="size-9 shrink-0 rounded-[10px] bg-bg-avatar" />
              <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <Skeleton className="h-3 w-[120px] rounded bg-bg-avatar" />
                <Skeleton className="h-3 w-[92%] rounded bg-bg-avatar" />
                <Skeleton className="h-3 w-[66%] rounded bg-bg-avatar" />
              </div>
            </div>
            <div className="pt-3.5 pb-1">
              <Skeleton className="h-[11px] w-[72px] rounded bg-bg-avatar" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 py-[7px]">
                <Skeleton className="size-9 shrink-0 rounded-[10px] bg-bg-avatar" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-[11px] w-24 rounded bg-bg-avatar" />
                  <Skeleton className={`h-3 rounded bg-bg-avatar ${["w-[84%]", "w-[58%]", "w-[72%]"][i]}`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {(isError || (!isPending && !thread)) && (
          <div className="px-5 pt-5 pb-6 text-center">
            <p className="text-[13.5px] font-semibold text-ink">This thread isn&apos;t available</p>
            <p className="mx-auto mt-[5px] max-w-[250px] text-[12.5px] leading-[1.5] text-fg-600 text-pretty">
              It may have been deleted, or you no longer have access to it.
            </p>
          </div>
        )}

        {thread && (
          <>
            <div className="border-b border-border">
              <MessageItem
                message={thread.parent}
                grouped={false}
                meId={me.id}
                canDelete={thread.parent.author_id === me.id || isAdmin}
                onToggleReaction={(emoji, active) => toggleReaction.mutate({ messageId: thread.parent.id, emoji, active })}
                onDelete={() => del.mutate(thread.parent.id)}
                onEdit={(content) => edit.mutate({ messageId: thread.parent.id, content })}
                onTogglePin={(on) => pin.mutate({ messageId: thread.parent.id, on })}
                onToggleSave={(on) => save.mutate({ messageId: thread.parent.id, on })}
                allowBroadcast={isChannel}
                inThread
              />
            </div>

            {thread.replies.length > 0 ? (
              <div className="flex items-center gap-2.5 px-4 pt-3 pb-0.5">
                <span className="text-[11.5px] font-bold tracking-[0.05em] uppercase text-muted-foreground">
                  {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
                </span>
                <span className="h-px flex-1 bg-bg-avatar" />
              </div>
            ) : (
              <div className="px-5 pt-5 pb-6 text-center">
                <p className="text-[13.5px] font-semibold text-ink">No replies yet</p>
                <p className="mx-auto mt-[5px] max-w-[250px] text-[12.5px] leading-[1.5] text-fg-600 text-pretty">
                  Replies stay here — {isChannel ? "the channel" : "the conversation"} keeps moving.
                </p>
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
                onEdit={(content) => edit.mutate({ messageId: m.id, content })}
                onTogglePin={(on) => pin.mutate({ messageId: m.id, on })}
                onToggleSave={(on) => save.mutate({ messageId: m.id, on })}
                allowBroadcast={isChannel}
                inThread
              />
            ))}
          </>
        )}
      </div>

      {/* The panel composer is the design's 10px card; the accent halo is its own focus state. */}
      {canPost && thread && !thread.parent.deleted_at && (
        <div className="shrink-0 px-4 pb-4 [&_.field-focus]:rounded-[10px]">
          <MessageComposer
            draftKey={`thread:${parentId}`}
            placeholder="Reply in thread"
            onSend={handleSend}
            compact
            allowBroadcast={isChannel}
            uploads={uploads}
          />
          <label className="mt-[9px] flex cursor-pointer items-start gap-2">
            <span className="relative mt-px grid size-4 shrink-0 place-items-center">
              <input
                type="checkbox"
                checked={alsoSend}
                onChange={(e) => setAlsoSend(e.target.checked)}
                className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-border-input bg-bg-card checked:border-accent-border checked:bg-primary focus-visible:outline-2 focus-visible:outline-ring"
              />
              <Check
                className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100"
                strokeWidth={3}
                aria-hidden="true"
              />
            </span>
            <span className="text-[12.5px] leading-[1.45] text-fg-600">
              Also send to <span className="font-semibold text-ink">{containerLabel}</span>
              {alsoSend && (isChannel ? " — everyone in the channel will see this reply." : " — everyone in this conversation will see this reply.")}
            </span>
          </label>
        </div>
      )}
    </aside>
  );
}

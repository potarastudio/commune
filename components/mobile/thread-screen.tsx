"use client";

import { Check } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { MessageItem } from "@/components/message/message-item";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useViewerTimezone } from "@/lib/viewer-timezone";
import { MobileComposer } from "./mobile-composer";
import { PushedHeader } from "./screen-header";

/**
 * A thread on the phone: its own pushed screen rather than a side panel —
 * the parent, a count, the replies, and a composer whose "Also send to" line
 * sits under the field where a thumb reaches it.
 */
export function ThreadScreen({
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
  const tz = useViewerTimezone();
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open on the newest reply, and follow new ones while you are at the bottom.
  const count = thread?.replies.length ?? -1;
  const atBottom = useRef(true);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [count]);

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
      atBottom.current = true;
    },
    [sendReply, alsoSend, uploads],
  );

  const item = (m: NonNullable<typeof thread>["replies"][number], grouped: boolean) => (
    <MessageItem
      key={m.id}
      message={m}
      grouped={grouped}
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
  );

  return (
    <>
      <PushedHeader title="Thread" subtitle={containerLabel} />
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg-main pb-[6px]"
        role="log"
        aria-label="Thread replies"
      >
        {isPending && (
          <div className="px-[16px] py-[14px]" aria-label="Loading thread">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-[10px] py-[7px]">
                <Skeleton className="size-[32px] shrink-0 rounded-[9px]" style={{ animationDelay: `${i * 120}ms` }} />
                <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                  <Skeleton className="h-[12px] w-[108px] rounded-[4px]" style={{ animationDelay: `${i * 120}ms` }} />
                  <Skeleton
                    className="h-[12px] rounded-[4px]"
                    style={{ animationDelay: `${i * 120}ms`, width: ["86%", "64%", "92%", "52%"][i] }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {(isError || (!isPending && !thread)) && (
          <div className="px-[24px] pt-[40px] text-center">
            <p className="text-[15px] font-semibold text-ink">This thread isn&rsquo;t available</p>
            <p className="mx-auto mt-[6px] max-w-[280px] text-[13.5px] leading-[1.55] text-fg-600">
              It may have been deleted, or you no longer have access to it.
            </p>
          </div>
        )}

        {thread && (
          <>
            <div className="border-b border-border pb-[4px]">{item(thread.parent, false)}</div>
            {thread.replies.length > 0 ? (
              <div className="flex items-center gap-[10px] px-[16px] pt-[12px] pb-[2px]">
                <span className="text-[11.5px] font-bold tracking-[0.05em] text-muted-foreground uppercase">
                  {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
                </span>
                <span className="h-px flex-1 bg-bg-avatar" />
              </div>
            ) : (
              <div className="px-[24px] pt-[28px] text-center">
                <p className="text-[14.5px] font-semibold text-ink">No replies yet</p>
                <p className="mx-auto mt-[5px] max-w-[260px] text-[13px] leading-[1.55] text-fg-600">
                  Replies stay here — {isChannel ? "the channel" : "the conversation"} keeps moving.
                </p>
              </div>
            )}
            {thread.replies.map((m, i) => item(m, shouldGroup(thread.replies[i - 1], m, tz) && !m.deleted_at))}
          </>
        )}
      </div>

      {canPost && thread && !thread.parent.deleted_at && (
        <MobileComposer
          draftKey={`thread:${parentId}`}
          placeholder="Reply in thread"
          onSend={handleSend}
          onSaveEdit={(messageId, content) => edit.mutate({ messageId, content })}
          allowBroadcast={isChannel}
          uploads={uploads}
          below={
            <label className="mt-[2px] flex min-h-[40px] cursor-pointer items-center gap-[10px] px-[12px]">
              <span className="relative grid size-[20px] shrink-0 place-items-center">
                <input
                  type="checkbox"
                  checked={alsoSend}
                  onChange={(e) => setAlsoSend(e.target.checked)}
                  className="peer size-[20px] cursor-pointer appearance-none rounded-[6px] border-[1.5px] border-border-input bg-bg-card checked:border-accent-border checked:bg-primary"
                />
                <Check className="pointer-events-none absolute size-[12px] text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
              </span>
              <span className="text-[13px] text-fg-600">
                Also send to <span className="font-semibold text-ink">{containerLabel}</span>
              </span>
            </label>
          }
        />
      )}
    </>
  );
}

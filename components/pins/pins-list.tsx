"use client";

import { Pin } from "lucide-react";
import Link from "next/link";
import { MessageItem } from "@/components/message/message-item";
import { Skeleton } from "@/components/ui/skeleton";
import { messageKeys, type Container, type Message, type MessageAuthor } from "@/lib/queries/messages";
import { useDeleteMessage, useEditMessage, usePins, useTogglePin, useToggleReaction, useToggleSave } from "@/lib/queries/use-messages";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** Everything pinned in a container, as the design's pinned rows. Lives in the details panel's Pins tab. */
export function PinsList({
  container,
  containerLabel,
  me,
  isAdmin,
  initialPins,
}: {
  container: Container;
  containerLabel: string;
  me: MessageAuthor;
  isAdmin: boolean;
  initialPins: Message[];
}) {
  const { openThread } = useThreadNav();
  const { data: pins, isPending } = usePins(container, initialPins);
  const keys = [messageKeys.container(container), messageKeys.pins(container)];
  const toggleReaction = useToggleReaction(keys, me.id);
  const del = useDeleteMessage(keys);
  const edit = useEditMessage(keys);
  const pin = useTogglePin(keys);
  const save = useToggleSave(keys);
  const base = container.kind === "channel" ? `/channel/${container.id}` : `/dm/${container.id}`;
  const items = (pins ?? []).filter((m) => m.is_pinned && !m.deleted_at);

  if (isPending) {
    return (
      <div aria-label="Loading pinned messages">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 border-b border-border-subtle px-4 py-3">
            <Skeleton className="size-9 shrink-0 rounded-[10px] bg-bg-avatar" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-[11px] w-[88px] rounded bg-bg-avatar" />
              <Skeleton className="h-[11px] w-[104px] rounded bg-bg-avatar" />
              <Skeleton className={`h-3 rounded bg-bg-avatar ${["w-[88%]", "w-[64%]", "w-[76%]"][i]}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    // The panel empty state, not the floating pinned-popover one: same tile,
    // heading and body scale as the Files tab it shares a tab strip with.
    return (
      <div className="px-6 py-12 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
          <Pin className="size-[17px]" aria-hidden="true" />
        </span>
        <h3 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No pins yet</h3>
        <p className="mt-[5px] text-pretty text-[13px] leading-[1.55] text-fg-600">
          Pin a message to keep it findable for everyone in {containerLabel}.
        </p>
      </div>
    );
  }

  // One hover surface per row: the nested MessageItem drops its pinned tint (the panel is
  // already all pins) and takes the panel's 16px gutter instead of the main pane's 24px.
  return (
    <div>
      {items.map((m) => (
        <article
          key={m.id}
          className="border-b border-border-subtle pt-1.5 last:border-b-0 hover:bg-bg-hover [&_article]:bg-transparent [&_article]:px-4"
        >
          <MessageItem
            message={m}
            grouped={false}
            meId={me.id}
            canDelete={m.author_id === me.id || isAdmin}
            onToggleReaction={(emoji, active) => toggleReaction.mutate({ messageId: m.id, emoji, active })}
            onDelete={() => del.mutate(m.id)}
            onEdit={(content) => edit.mutate({ messageId: m.id, content })}
            onTogglePin={(on) => pin.mutate({ messageId: m.id, on })}
            onToggleSave={(on) => save.mutate({ messageId: m.id, on })}
            onReply={m.parent_id ? undefined : () => openThread(m.id)}
            allowBroadcast={container.kind === "channel"}
            inThread
          />
          <div className="flex gap-1.5 pt-2 pr-4 pb-3 pl-16">
            <Link
              href={m.parent_id ? `${base}?thread=${m.parent_id}` : `${base}?message=${m.id}`}
              scroll={false}
              className="flex h-[26px] items-center rounded-[7px] border border-border-strong bg-bg-card px-[9px] text-[12px] font-semibold text-ink hover:bg-bg-card-hover focus-visible:outline-2 focus-visible:outline-ring"
            >
              {m.parent_id ? "Open thread" : "Jump"}
            </Link>
            <button
              type="button"
              onClick={() => pin.mutate({ messageId: m.id, on: false })}
              className="flex h-[26px] items-center rounded-[7px] px-2 text-[12px] font-semibold text-muted-foreground hover:bg-bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
            >
              Unpin
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

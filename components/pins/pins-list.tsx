"use client";

import { ArrowUpRight, Pin } from "lucide-react";
import Link from "next/link";
import { MessageItem } from "@/components/message/message-item";
import { Skeleton } from "@/components/ui/skeleton";
import { messageKeys, type Container, type Message, type MessageAuthor } from "@/lib/queries/messages";
import { useDeleteMessage, useEditMessage, usePins, useTogglePin, useToggleReaction, useToggleSave } from "@/lib/queries/use-messages";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** Everything pinned in a container, as full message items with a jump link. Lives in the details panel's Pins tab. */
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
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Pin className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold tracking-tight">Nothing pinned yet</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Hover a message and choose <strong className="font-medium text-foreground">Pin</strong> to keep it here for everyone in {containerLabel}.
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {items.map((m) => (
        <div key={m.id} className="group/pin border-b border-divider pb-2 last:border-b-0">
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
          <Link
            href={m.parent_id ? `${base}?thread=${m.parent_id}` : `${base}?message=${m.id}`}
            scroll={false}
            className="ml-5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-link hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            {m.parent_id ? "Open thread" : "Jump to message"}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ))}
    </div>
  );
}

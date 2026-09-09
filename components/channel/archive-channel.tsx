"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setChannelArchivedAction } from "@/lib/actions/channels";

/** Admin-only, two-step: the first click asks, the second archives. Inline, no modal (§6). */
export function ArchiveChannelControl({ channelId, channelName }: { channelId: string; channelName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const archive = () =>
    startTransition(async () => {
      const result = await setChannelArchivedAction({ channelId, archived: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`#${channelName} is archived`, { description: "It stays readable and searchable. Nobody can post." });
      router.refresh();
    });

  if (channelName === "general") return null;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        /* Quiet at rest so Leave stays the tab's single red button; the
           consequence shows on hover and again in the confirm step. */
        className="flex h-[34px] w-full items-center justify-center gap-[7px] rounded-md border border-border-strong bg-bg-card px-3 text-[13px] font-semibold text-fg-600 shadow-xs transition-colors hover:border-danger hover:bg-danger-surface hover:text-danger"
      >
        <Archive className="size-[14px]" aria-hidden="true" />
        Archive channel
      </button>
    );
  }

  return (
    /* Neutral body, danger reserved for the tile and the confirming action —
       a danger-surface tile on a danger-surface body would be invisible. */
    <div className="rounded-lg border border-border bg-bg-card p-3 shadow-xs" role="group" aria-label="Confirm archive">
      <div className="flex gap-[13px]">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-lg border border-danger bg-danger-surface text-danger" aria-hidden="true">
          <Archive className="size-[17px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">Archive #{channelName}?</p>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-fg-600">
            It leaves everyone&apos;s sidebar and nobody can post, but it stays readable and searchable. You can bring it back later.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2.5">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={archive}>
          {pending ? "Archiving…" : "Archive"}
        </Button>
      </div>
    </div>
  );
}

/** Sits in the read-only notice of an archived channel. */
export function UnarchiveButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const restore = () =>
    startTransition(async () => {
      const result = await setChannelArchivedAction({ channelId, archived: false });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`#${channelName} is back`);
      router.refresh();
    });
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={restore}>
      <ArchiveRestore className="size-[14px]" aria-hidden="true" />
      {pending ? "Restoring…" : "Unarchive"}
    </Button>
  );
}

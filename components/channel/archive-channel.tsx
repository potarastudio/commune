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
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Archive className="size-4" aria-hidden="true" />
        Archive channel
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted p-3 text-[13px]" role="group" aria-label="Confirm archive">
      <p>
        Archive <strong>#{channelName}</strong>? It leaves everyone&apos;s sidebar and nobody can post, but it stays readable and searchable. You can bring it back later.
      </p>
      <div className="mt-2 flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
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
      <ArchiveRestore className="size-3.5" aria-hidden="true" />
      {pending ? "Restoring…" : "Unarchive"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditHistory } from "@/lib/queries/edits";
import { renderContent } from "@/lib/utils/render";
import { formatFullTimestamp } from "@/lib/utils/time";

/** The "(edited)" label; click for every earlier version, newest first (§5 Phase 3). */
export function EditHistory({ messageId, editedAt }: { messageId: string; editedAt: string | null }) {
  const [open, setOpen] = useState(false);
  const { data, isPending } = useEditHistory(messageId, open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ml-1 rounded-sm align-baseline text-[12px] text-muted-foreground hover:text-fg-400 hover:underline"
          aria-label="Show edit history"
          title={editedAt ? `Edited ${formatFullTimestamp(editedAt)}` : "Edited"}
        >
          (edited)
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-[13.5px] font-semibold text-ink">Edit history</h3>
          {editedAt && <p className="mt-px text-[12px] text-muted-foreground">Last edited {formatFullTimestamp(editedAt)}</p>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isPending && (
            <div className="space-y-3 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          )}
          {data && data.length === 0 && <p className="px-4 py-5 text-[13px] text-fg-600">This message has no earlier versions.</p>}
          {data && data.length > 0 && (
            <ol className="divide-y divide-border">
              {data.map((v, i) => (
                <li key={v.id} className="px-4 py-3">
                  <p className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.05em] text-fg-600">
                    {i === data.length - 1 ? "Original" : `Version ${data.length - i}`} · until {formatFullTimestamp(v.edited_at)}
                  </p>
                  <div className="text-[13px] leading-[1.55] text-body [&>p+p]:mt-1">{renderContent(v.content as Parameters<typeof renderContent>[0])}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

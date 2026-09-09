"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { Bookmark, Hash } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleSaveAction } from "@/lib/actions/messages";
import { messageHref } from "@/lib/queries/activity";
import { fetchSaved, messageKeys, type SavedMessage } from "@/lib/queries/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { renderContent } from "@/lib/utils/render";

function when(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Today ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "d MMM");
}

/** Saved for later (§5 Phase 3): the user's private reading list, newest save first. */
export function SavedList({ meId, initialSaved }: { meId: string; initialSaved: SavedMessage[] }) {
  const queryClient = useQueryClient();
  const key = messageKeys.saved(meId);
  const { data: saved } = useQuery({
    queryKey: key,
    queryFn: () => fetchSaved(getSupabaseBrowserClient(), meId),
    initialData: initialSaved,
    staleTime: 30_000,
  });

  const unsave = useMutation({
    mutationFn: (messageId: string) => toggleSaveAction({ messageId, saved: false }),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedMessage[]>(key);
      queryClient.setQueryData<SavedMessage[]>(key, (old) => (old ?? []).filter((s) => s.message.id !== messageId));
      // Keep any open message list in step, so the bookmark icon there flips too.
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["messages"] })
        .forEach((q) => void queryClient.invalidateQueries({ queryKey: q.queryKey }));
      return { previous };
    },
    onSuccess: (result) => {
      if (!result.ok) throw new Error(result.error);
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error("Couldn't remove that", { description: "Try again in a moment." });
      console.error("unsave", err);
    },
  });

  const items = saved ?? [];

  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
        <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
          <Bookmark className="size-[17px]" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">Nothing saved yet</h2>
        <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
          Save a message to come back to it later. It stays here until you clear it.
        </p>
      </div>
    );
  }

  return (
    <ul>
      {items.map(({ message: m, saved_at }) => (
        <li key={m.id} className="flex items-start border-b border-border-subtle transition-colors hover:bg-bg-hover">
          <Link href={messageHref(m)} className="min-w-0 flex-1 px-5 py-[13px]">
            <span className="flex flex-wrap items-baseline gap-1.5 text-[12.5px] text-muted-foreground">
              {m.channel ? (
                <span className="inline-flex items-center gap-1 font-semibold text-fg-400">
                  <Hash className="size-[11px] text-muted-foreground" aria-hidden="true" />
                  {m.channel.name}
                </span>
              ) : (
                <span className="font-semibold text-fg-400">Direct message</span>
              )}
              <span>·</span>
              <span className="font-semibold text-fg-400">{m.author?.display_name ?? "Someone"}</span>
              <span>·</span>
              <time dateTime={saved_at} className="tabular-nums">
                {when(saved_at)}
              </time>
              {m.parent_id && (
                <>
                  <span>·</span>
                  <span>in a thread</span>
                </>
              )}
            </span>
            <div className="mt-1 text-[13.5px] leading-[1.55] text-body [text-wrap:pretty] [&>p]:inline">
              {m.deleted_at ? (
                <span className="italic text-muted-foreground">This message was deleted</span>
              ) : (
                renderContent(m.content as Parameters<typeof renderContent>[0])
              )}
            </div>
          </Link>
          <div className="shrink-0 py-[13px] pr-5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => unsave.mutate(m.id)}
                  aria-label="Remove from saved"
                  className="grid size-7 place-items-center rounded-[7px] text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
                >
                  <Bookmark className="size-[15px] fill-current" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Remove from saved</TooltipContent>
            </Tooltip>
          </div>
        </li>
      ))}
    </ul>
  );
}

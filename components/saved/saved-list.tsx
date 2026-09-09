"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkX } from "lucide-react";
import { toast } from "sonner";
import { ActivityItem } from "@/components/activity/activity-item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleSaveAction } from "@/lib/actions/messages";
import { messageHref } from "@/lib/queries/activity";
import { fetchSaved, messageKeys, type SavedMessage } from "@/lib/queries/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { renderContent } from "@/lib/utils/render";

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
  const where = (m: SavedMessage["message"]) => (m.channel ? `#${m.channel.name}` : m.conversation ? "a direct message" : "");

  if (items.length === 0) {
    return (
      <div className="mt-10 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Bookmark className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-[18px] font-semibold tracking-tight">Nothing saved yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Hover a message and choose <strong className="font-medium text-foreground">Save for later</strong>. Only you can see this list.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-2 space-y-0.5">
      {items.map(({ message: m, saved_at }) => (
        <ActivityItem
          key={m.id}
          href={messageHref(m)}
          person={m.author}
          createdAt={saved_at}
          eyebrow={
            <>
              <span className="font-medium text-foreground">{m.author?.display_name ?? "Someone"}</span> in {where(m)}
              {m.parent_id ? " · in a thread" : ""}
            </>
          }
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => unsave.mutate(m.id)}
                  aria-label="Remove from saved"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/item:opacity-100"
                >
                  <BookmarkX className="size-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Remove from saved</TooltipContent>
            </Tooltip>
          }
        >
          {m.deleted_at ? (
            <span className="italic text-muted-foreground">This message was deleted</span>
          ) : (
            renderContent(m.content as Parameters<typeof renderContent>[0])
          )}
        </ActivityItem>
      ))}
    </ul>
  );
}

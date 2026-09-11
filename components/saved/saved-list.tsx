"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Hash } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RemindMenu } from "@/components/message/remind-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleSaveAction } from "@/lib/actions/messages";
import { messageHref } from "@/lib/queries/activity";
import { fetchSaved, messageKeys, type SavedMessage } from "@/lib/queries/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { renderContent } from "@/lib/utils/render";
import { daysAgo, formatMessageTime, formatShortDate } from "@/lib/utils/time";
import { useViewerTimezone } from "@/lib/viewer-timezone";

/** "Today 21:07", "Yesterday 09:15", "10 Sep", in the viewer's zone. */
function when(iso: string, tz: string, now = new Date()) {
  const ago = daysAgo(iso, tz, now);
  if (ago === 0) return `Today ${formatMessageTime(iso, tz)}`;
  if (ago === 1) return `Yesterday ${formatMessageTime(iso, tz)}`;
  return formatShortDate(iso, tz, now);
}

/**
 * The filter band above the rows. The design splits Saved into All / In progress
 * / Done, but `saved_messages` stores only (user, message, created_at) — there is
 * no done flag to filter on and we do not fake one — so the band keeps the
 * design's geometry and filters on what a saved row actually knows: where it came
 * from.
 */
type Filter = "all" | "channels" | "dms";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "channels", label: "Channels" },
  { id: "dms", label: "Direct messages" },
];

/** How long the checkbox holds its checked state before the row leaves the list. */
const DONE_FLASH_MS = 320;

/** Saved for later (§5 Phase 3): the user's private reading list, newest save first. */
export function SavedList({ meId, initialSaved }: { meId: string; initialSaved: SavedMessage[] }) {
  const tz = useViewerTimezone();
  const queryClient = useQueryClient();
  const key = messageKeys.saved(meId);
  const { data: saved } = useQuery({
    queryKey: key,
    queryFn: () => fetchSaved(getSupabaseBrowserClient(), meId),
    initialData: initialSaved,
    staleTime: 30_000,
  });

  const [filter, setFilter] = useState<Filter>("all");
  // Rows whose checkbox is ticked and are on their way out of the list.
  const [done, setDone] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    };
  }, []);

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
    onError: (err, messageId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      setDone((d) => d.filter((id) => id !== messageId));
      toast.error("Couldn't remove that", { description: "Try again in a moment." });
      console.error("unsave", err);
    },
  });

  /**
   * "Mark as done". We have nowhere to persist a done flag, so done means the
   * same thing as clearing the save — the checkbox ticks, then the row leaves.
   */
  const markDone = (messageId: string) => {
    if (timers.current.has(messageId)) return;
    setDone((d) => [...d, messageId]);
    timers.current.set(
      messageId,
      setTimeout(() => {
        timers.current.delete(messageId);
        unsave.mutate(messageId);
      }, DONE_FLASH_MS),
    );
  };

  const items = saved ?? [];
  const counts = {
    all: items.length,
    channels: items.filter((s) => s.message.channel).length,
    dms: items.filter((s) => !s.message.channel).length,
  };
  const visible = items.filter((s) => (filter === "all" ? true : filter === "channels" ? !!s.message.channel : !s.message.channel));

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
          <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
            <Bookmark className="size-[17px]" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">Nothing saved yet</h2>
          <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
            Save a message to come back to it later. It stays here until you clear it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div role="tablist" aria-label="Filter saved messages" className="flex shrink-0 gap-0.5 border-b border-border px-5 py-[9px]">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex h-[30px] items-center gap-[7px] rounded-md border px-[11px] text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-border-strong bg-bg-card text-ink shadow-xs"
                  : "border-transparent text-fg-600 hover:bg-bg-subtle hover:text-ink",
              )}
            >
              {f.label}
              <span className="tabular-nums text-muted-foreground">{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {visible.length === 0 ? (
          <p className="border-b border-border-subtle px-5 py-[13px] text-[13px] leading-[1.55] text-fg-600">
            {filter === "channels"
              ? "Nothing saved from a channel yet."
              : "Nothing saved from a direct message yet."}
          </p>
        ) : (
          <ul>
            {visible.map(({ message: m, saved_at }) => {
              const isDone = done.includes(m.id);
              return (
                <li key={m.id} className="flex items-start border-b border-border-subtle transition-colors hover:bg-bg-hover">
                  <div className="shrink-0 py-[13px] pl-5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isDone}
                          aria-label="Mark as done"
                          onClick={() => markDone(m.id)}
                          className={cn(
                            "mt-[2px] grid size-[19px] place-items-center rounded-[6px] border-[1.5px] transition-colors",
                            isDone
                              ? "border-accent-border bg-primary text-primary-foreground"
                              : "border-border-input bg-bg-card text-transparent hover:border-border-hover",
                          )}
                        >
                          <Check className="size-[11px]" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Mark as done · clears it from Saved</TooltipContent>
                    </Tooltip>
                  </div>

                  <Link href={messageHref(m)} className="min-w-0 flex-1 py-[13px] pl-3">
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
                      {/* "Today" depends on the moment; keep the server's word through hydration. */}
                      <time dateTime={saved_at} className="tabular-nums" suppressHydrationWarning>
                        {when(saved_at, tz)}
                      </time>
                      {m.parent_id && (
                        <>
                          <span>·</span>
                          <span>in a thread</span>
                        </>
                      )}
                    </span>
                    <div
                      className={cn(
                        "mt-1 text-[13.5px] leading-[1.55] [text-wrap:pretty] [&>p]:inline",
                        isDone ? "text-muted-foreground line-through" : "text-body",
                      )}
                    >
                      {m.deleted_at ? (
                        <span className="italic text-muted-foreground">This message was deleted</span>
                      ) : (
                        renderContent(m.content as Parameters<typeof renderContent>[0])
                      )}
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-start gap-0.5 py-[13px] pr-5">
                    {/* The design's 28px clock button. RemindMenu already owns the
                        reminder flow, so it only needs the feed row's trim. */}
                    <span className="[&>button]:rounded-[7px] [&>button]:text-fg-600 [&_svg]:size-[15px]">
                      <RemindMenu messageId={m.id} />
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => unsave.mutate(m.id)}
                          aria-label="Remove from saved"
                          className="grid size-7 place-items-center rounded-[7px] text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
                        >
                          <Bookmark className="size-[15px]" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Remove from saved</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

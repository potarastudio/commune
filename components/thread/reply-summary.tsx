"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileMap } from "@/lib/queries/profiles";

/** "3 replies · avatars · Last reply 5 min ago" under a threaded parent (§5). */
export function ReplySummary({
  count,
  lastReplyAt,
  participantIds,
  onOpen,
}: {
  count: number;
  lastReplyAt: string | null;
  participantIds: string[];
  onOpen: () => void;
}) {
  const profiles = useProfileMap();
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur();
        onOpen();
      }}
      className="group/replies mt-1.5 -ml-1.5 flex h-8 max-w-full items-center gap-2 rounded-md border border-transparent px-1.5 text-[13px] hover:border-border hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Open thread, ${count} ${count === 1 ? "reply" : "replies"}`}
    >
      <span className="flex -space-x-1">
        {participantIds.slice(0, 4).map((id) => {
          const p = profiles.get(id);
          return (
            <Avatar key={id} className="size-5 rounded ring-2 ring-background">
              <AvatarImage src={p?.avatar_url ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="rounded bg-accent text-[9px] font-semibold text-accent-foreground">
                {(p?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
        })}
      </span>
      <span className="font-medium text-link">
        {count} {count === 1 ? "reply" : "replies"}
      </span>
      {lastReplyAt && (
        <span className="truncate text-muted-foreground">
          <span className="group-hover/replies:hidden">Last reply {formatDistanceToNowStrict(new Date(lastReplyAt), { addSuffix: true })}</span>
          <span className="hidden group-hover/replies:inline">View thread</span>
        </span>
      )}
    </button>
  );
}

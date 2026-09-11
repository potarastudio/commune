"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileMap } from "@/lib/queries/profiles";
import { useHydrated } from "@/lib/utils/use-hydrated";

/** "avatars · 4 replies · Last reply 2h ago" under a threaded parent (§5). */
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
  // Profiles load only in the browser; the server draws "?" placeholders, so
  // the hydration render must too, and the faces arrive a frame later.
  const hydrated = useHydrated();
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur();
        onOpen();
      }}
      className="group/replies mt-2 -ml-2 flex h-8 max-w-full items-center gap-[9px] rounded-md px-2 text-[13px] hover:bg-bg-chip focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Open thread, ${count} ${count === 1 ? "reply" : "replies"}`}
    >
      <span className="flex">
        {participantIds.slice(0, 4).map((id, i) => {
          const p = hydrated ? profiles.get(id) : undefined;
          return (
            <Avatar key={id} className={`size-[22px] rounded-full bg-bg-avatar ring-2 ring-bg-main ${i > 0 ? "-ml-1.5" : ""}`}>
              <AvatarImage src={p?.avatar_url ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="rounded-full bg-bg-avatar text-[9px] font-semibold text-fg-600">
                {(p?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
        })}
      </span>
      <span className="shrink-0 font-semibold text-ink">
        {count} {count === 1 ? "reply" : "replies"}
      </span>
      {lastReplyAt && (
        <span className="truncate text-muted-foreground">
          {/* "3 minutes ago" is worked out from the clock, once on the server and
              again in the browser a moment later; the two can straddle a
              boundary. React's escape hatch for exactly this: keep the server's
              text through hydration rather than report it as a mismatch. */}
          <span className="group-hover/replies:hidden" suppressHydrationWarning>
            Last reply {formatDistanceToNowStrict(new Date(lastReplyAt), { addSuffix: true })}
          </span>
          <span className="hidden group-hover/replies:inline">View thread</span>
        </span>
      )}
    </button>
  );
}

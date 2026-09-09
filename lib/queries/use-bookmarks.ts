"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { bookmarkKeys, fetchBookmarks, type Bookmark } from "./bookmarks";

export type { Bookmark } from "./bookmarks";

/** Server-rendered first, then live: any change to the channel's bookmarks refetches. */
export function useBookmarks(channelId: string, initialData: Bookmark[]) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: bookmarkKeys.channel(channelId),
    queryFn: () => fetchBookmarks(getSupabaseBrowserClient(), channelId),
    initialData,
    staleTime: 60_000,
  });
  useEffect(() => {
    const key = bookmarkKeys.channel(channelId);
    return subscribeWithAuth(
      getSupabaseBrowserClient(),
      `bookmarks:${channelId}`,
      (channel) =>
        channel.on("postgres_changes", { event: "*", schema: "public", table: "channel_bookmarks", filter: `channel_id=eq.${channelId}` }, () => {
          void queryClient.invalidateQueries({ queryKey: key });
        }),
      `bookmarks:${channelId}`,
    );
  }, [channelId, queryClient]);
  return query;
}

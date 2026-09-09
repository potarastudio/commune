"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toUnreadMap, unreadKeyFor, type UnreadMap } from "@/lib/utils/unreads";
import type { Container, MessageRow } from "./messages";

export type { UnreadMap } from "@/lib/utils/unreads";

export const unreadKeys = { all: ["unreads"] as const };

export async function fetchUnreadMap(): Promise<UnreadMap> {
  const { data, error } = await getSupabaseBrowserClient().rpc("get_unread_counts");
  if (error) throw new Error(error.message);
  return toUnreadMap(data);
}

export function clearUnread(queryClient: QueryClient, container: Container) {
  queryClient.setQueryData<UnreadMap>(unreadKeys.all, (old) =>
    old ? { ...old, [unreadKeyFor(container)]: { unread: 0, has_mention: false } } : old,
  );
}

/**
 * Sidebar unread counts (§5). Server-rendered initial map; a new message
 * anywhere I can read (RLS-filtered by Realtime) refetches the counts.
 */
export function useUnreadCounts(initial: UnreadMap, meId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: unreadKeys.all,
    queryFn: fetchUnreadMap,
    initialData: initial,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = subscribeWithAuth(
      supabase,
      "unreads",
      (channel) =>
        channel
          .on<MessageRow>("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
            const row = payload.new;
            if (row.author_id === meId || row.parent_id) return;
            clearTimeout(timer);
            timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: unreadKeys.all }), 300);
          }),
      "unreads",
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [meId, queryClient]);

  return query.data;
}

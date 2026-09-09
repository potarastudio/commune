"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getActiveHuddle, huddleKeys, type ActiveHuddle } from "./huddles";
import type { Container } from "./messages";

/** The live huddle in a container: server-rendered, refreshed on any huddle/participant change. */
export function useActiveHuddle(container: Container, initial: ActiveHuddle | null) {
  const queryClient = useQueryClient();
  const key = huddleKeys.container(container);

  const query = useQuery({
    queryKey: key,
    queryFn: () => getActiveHuddle(getSupabaseBrowserClient(), container),
    initialData: initial,
    staleTime: 15_000,
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: key }), 250);
    };
    const column = container.kind === "channel" ? "channel_id" : "conversation_id";
    const stop = subscribeWithAuth(
      supabase,
      `huddle:${container.kind}:${container.id}`,
      (channel) =>
        channel
          .on("postgres_changes", { event: "*", schema: "public", table: "huddles", filter: `${column}=eq.${container.id}` }, bump)
          .on("postgres_changes", { event: "*", schema: "public", table: "huddle_participants" }, bump),
      `huddle:${container.id}`,
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container.kind, container.id, queryClient]);

  return query.data ?? null;
}

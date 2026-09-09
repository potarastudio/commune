"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "./profile";

export const profileKeys = { all: ["profiles"] as const };

/** Every member's profile. The team is ~12 people, so one query and a long cache. */
export function useProfiles() {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient()
        .from("profiles")
        .select("*")
        .order("display_name");
      if (error) throw new Error(error.message);
      return data as Profile[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Mounted once in the app shell: any profile change (status, name, avatar) refreshes the shared profiles query. */
export function useProfilesRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = subscribeWithAuth(
      getSupabaseBrowserClient(),
      "profiles",
      (channel) =>
        channel.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: profileKeys.all }), 200);
        }),
      "profiles",
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [queryClient]);
}

export function useProfileMap() {
  const { data } = useProfiles();
  return useMemo(() => new Map((data ?? []).map((p) => [p.id, p])), [data]);
}

/** True when nobody else uses this handle. Undefined while checking or when the handle is invalid. */
export function useHandleAvailable(handle: string, excludeId: string) {
  return useQuery({
    queryKey: ["handle-available", handle, excludeId],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient()
        .from("profiles")
        .select("id")
        .eq("handle", handle)
        .neq("id", excludeId)
        .limit(1);
      if (error) throw new Error(error.message);
      return data.length === 0;
    },
    enabled: handle.length > 0,
    staleTime: 10_000,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
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

export function useProfileMap() {
  const { data } = useProfiles();
  const map = new Map<string, Profile>();
  for (const p of data ?? []) map.set(p.id, p);
  return map;
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

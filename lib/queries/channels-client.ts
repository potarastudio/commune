"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Channel } from "./channels";

export const channelKeys = { browse: ["channels", "browse"] as const };

/** Every channel the user can see: joined ones plus public ones to browse. */
export function useBrowseableChannels(enabled = true) {
  return useQuery({
    queryKey: channelKeys.browse,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient()
        .from("channels")
        .select("*")
        .eq("is_archived", false)
        .order("name");
      if (error) throw new Error(error.message);
      return data as Channel[];
    },
    enabled,
    staleTime: 60_000,
  });
}

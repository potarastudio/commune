"use client";

import { useQuery } from "@tanstack/react-query";

export type LinkPreview = {
  url: string;
  ok: boolean;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
};

/** One preview per URL, fetched through /api/unfurl (server cache behind it). */
export function useLinkPreview(url: string) {
  return useQuery({
    queryKey: ["link-preview", url],
    queryFn: async (): Promise<LinkPreview> => {
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`unfurl ${res.status}`);
      return (await res.json()) as LinkPreview;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 0,
  });
}

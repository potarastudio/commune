"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type CustomEmoji = { name: string; url: string; created_by: string | null; created_at: string };

export const customEmojiKeys = { all: ["custom-emoji"] as const };

/**
 * Cache-only view of the custom emoji set, for rendering. It never fetches
 * itself (the app shell's useCustomEmoji does), so message rendering stays
 * free of Supabase imports and can be unit-tested without an environment.
 */
export function useCustomEmojiMap() {
  const { data } = useQuery<CustomEmoji[]>({ queryKey: customEmojiKeys.all, queryFn: skipToken, staleTime: Infinity });
  return useMemo(() => new Map((data ?? []).map((e) => [e.name, e.url])), [data]);
}

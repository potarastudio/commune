"use client";

import { useQuery } from "@tanstack/react-query";
import type { Json } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type MessageEdit = { id: string; content: Json; content_text: string; edited_at: string; editor: { display_name: string } | null };

export const editKeys = { message: (id: string) => ["edits", id] as const };

/** Previous versions of a message, newest first. RLS: readable with the message. */
export async function fetchEditHistory(messageId: string): Promise<MessageEdit[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("message_edits")
    .select("id, content, content_text, edited_at, editor:profiles!message_edits_edited_by_fkey(display_name)")
    .eq("message_id", messageId)
    .order("edited_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as MessageEdit[];
}

export function useEditHistory(messageId: string, enabled: boolean) {
  return useQuery({ queryKey: editKeys.message(messageId), queryFn: () => fetchEditHistory(messageId), enabled, staleTime: 0 });
}

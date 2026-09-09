"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AttachmentRow, Container } from "./messages";

type Supabase = SupabaseClient<Database>;

export type ContainerFile = AttachmentRow & {
  message: { id: string; parent_id: string | null; created_at: string; author: { id: string; display_name: string } | null };
};

export const fileKeys = { container: (c: Container) => ["files", c.kind, c.id] as const };

/** Every attachment shared in a channel or DM, newest first. RLS hides what the caller can't read. */
export async function fetchContainerFiles(supabase: Supabase, container: Container, limit = 100): Promise<ContainerFile[]> {
  const column = container.kind === "channel" ? "channel_id" : "conversation_id";
  const { data, error } = await supabase
    .from("attachments")
    .select("*, message:messages!inner(id, parent_id, created_at, deleted_at, author:profiles!messages_author_id_fkey(id, display_name))")
    .eq(`message.${column}`, container.id)
    .is("message.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const { message, ...file } = row as unknown as AttachmentRow & { message: ContainerFile["message"] | null };
    return message ? [{ ...file, message }] : [];
  });
}

export function useContainerFiles(container: Container, enabled = true) {
  return useQuery({
    queryKey: fileKeys.container(container),
    queryFn: () => fetchContainerFiles(getSupabaseBrowserClient(), container),
    enabled,
    staleTime: 30_000,
  });
}

/** Called from the message feed when a message with attachments lands, so an open Files tab stays current. */
export function invalidateFiles(queryClient: QueryClient, container: Container) {
  void queryClient.invalidateQueries({ queryKey: fileKeys.container(container) });
}

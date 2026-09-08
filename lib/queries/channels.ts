import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type NotificationLevel = "all" | "mentions" | "muted";
export type JoinedChannel = Channel & { notification_level: NotificationLevel };

/** Channels the current user has joined, for the sidebar. Server-side. */
export async function getJoinedChannels(supabase: SupabaseServerClient, userId: string): Promise<JoinedChannel[]> {
  const { data, error } = await supabase
    .from("channel_members")
    .select("notification_level, channels(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);

  return data
    .flatMap((row) =>
      row.channels && !row.channels.is_archived
        ? [{ ...row.channels, notification_level: row.notification_level as NotificationLevel }]
        : [],
    )
    .sort((a, b) => (a.name === "general" ? -1 : b.name === "general" ? 1 : a.name.localeCompare(b.name)));
}

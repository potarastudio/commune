import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Container } from "./messages";

type Supabase = SupabaseClient<Database>;

export type ScheduledMessage = Database["public"]["Tables"]["scheduled_messages"]["Row"];
export type UpcomingReminder = {
  id: string;
  remind_at: string;
  message: {
    id: string;
    content_text: string;
    parent_id: string | null;
    channel: { id: string; name: string } | null;
    conversation: { id: string } | null;
    author: { display_name: string } | null;
  };
};

export const schedulingKeys = {
  scheduled: (c: Container) => ["scheduled", c.kind, c.id] as const,
  reminders: ["reminders"] as const,
};

/** My unsent scheduled messages for one container, soonest first. RLS returns only mine. */
export async function fetchScheduled(supabase: Supabase, container: Container): Promise<ScheduledMessage[]> {
  const column = container.kind === "channel" ? "channel_id" : "conversation_id";
  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq(column, container.id)
    .is("sent_message_id", null)
    .is("failed", null)
    .order("send_at");
  if (error) throw new Error(error.message);
  return data;
}


/** My reminders that haven't fired yet, soonest first. */
export async function fetchUpcomingReminders(supabase: Supabase): Promise<UpcomingReminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select(
      "id, remind_at, message:messages!inner(id, content_text, parent_id, channel:channels(id, name), conversation:conversations(id), author:profiles!messages_author_id_fkey(display_name))",
    )
    .is("delivered_at", null)
    .order("remind_at");
  if (error) throw new Error(error.message);
  return data as unknown as UpcomingReminder[];
}

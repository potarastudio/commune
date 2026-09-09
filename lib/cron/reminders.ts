import "server-only";

import type { Json } from "@/types/database";
import { publicEnv } from "@/lib/env";
import { pushToUsers } from "@/lib/push/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ReminderRun = { due: number; delivered: number; failed: number };

type DueReminder = {
  id: string;
  user_id: string;
  message: { id: string; content_text: string; parent_id: string | null; channel_id: string | null; conversation_id: string | null; author: { display_name: string } | null; channel: { name: string } | null } | null;
};

function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || "a message with a file";
}

/** The user's notes-to-self conversation (exactly one member), created on first use. */
async function selfConversation(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string): Promise<string> {
  const { data: mine } = await admin.from("conversation_members").select("conversation_id").eq("user_id", userId);
  const ids = (mine ?? []).map((m) => m.conversation_id);
  if (ids.length) {
    const { data: counts } = await admin.from("conversation_members").select("conversation_id").in("conversation_id", ids);
    const tally = new Map<string, number>();
    for (const c of counts ?? []) tally.set(c.conversation_id, (tally.get(c.conversation_id) ?? 0) + 1);
    const solo = ids.find((id) => tally.get(id) === 1);
    if (solo) return solo;
  }
  const { data: conv, error } = await admin.from("conversations").insert({}).select("id").single();
  if (error || !conv) throw new Error(error?.message ?? "could not create conversation");
  const { error: memberError } = await admin.from("conversation_members").insert({ conversation_id: conv.id, user_id: userId });
  if (memberError) throw new Error(memberError.message);
  return conv.id;
}

/**
 * Fire due reminders: a note in the user's own DM linking back to the message,
 * plus a push. Runs from the cron route with the service role.
 */
export async function deliverDueReminders(): Promise<ReminderRun> {
  const admin = createSupabaseAdminClient();
  const run: ReminderRun = { due: 0, delivered: 0, failed: 0 };
  const { data: due, error } = await admin
    .from("reminders")
    .select("id, user_id, message:messages(id, content_text, parent_id, channel_id, conversation_id, author:profiles!messages_author_id_fkey(display_name), channel:channels(name))")
    .lte("remind_at", new Date().toISOString())
    .is("delivered_at", null)
    .order("remind_at")
    .limit(50);
  if (error) throw new Error(`reminders: ${error.message}`);
  const rows = (due ?? []) as unknown as DueReminder[];
  run.due = rows.length;
  const base = publicEnv.NEXT_PUBLIC_APP_URL;

  for (const r of rows) {
    try {
      if (!r.message) {
        await admin.from("reminders").update({ delivered_at: new Date().toISOString() }).eq("id", r.id);
        continue;
      }
      const m = r.message;
      const path = m.channel_id ? `/channel/${m.channel_id}` : `/dm/${m.conversation_id}`;
      const url = `${base}${path}?${m.parent_id ? `thread=${m.parent_id}` : `message=${m.id}`}`;
      const where = m.channel ? `#${m.channel.name}` : "a direct message";
      const who = m.author?.display_name ?? "Someone";
      const text = excerpt(m.content_text);

      const content: Json = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "⏰ Reminder: " },
              { type: "text", text: `${who} in ${where}`, marks: [{ type: "bold" }] },
              { type: "text", text: " · " },
              { type: "text", text, marks: [{ type: "link", attrs: { href: url, target: "_blank", rel: "noopener noreferrer" } }] },
            ],
          },
        ],
      };
      const conversationId = await selfConversation(admin, r.user_id);
      const { error: insertError } = await admin
        .from("messages")
        .insert({ conversation_id: conversationId, author_id: r.user_id, content, content_text: `⏰ Reminder: ${who} in ${where} · ${text} ${url}` });
      if (insertError) throw new Error(insertError.message);

      await admin.from("reminders").update({ delivered_at: new Date().toISOString() }).eq("id", r.id);
      run.delivered += 1;
      void pushToUsers([r.user_id], { title: "Reminder", body: `${who} in ${where}: ${text}`, url, tag: `reminder-${r.id}` });
    } catch (err) {
      run.failed += 1;
      console.error("deliverDueReminders", { id: r.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return run;
}

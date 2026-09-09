import "server-only";

import { notifyForMessage } from "@/lib/push/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ScheduledRun = { due: number; sent: number; failed: number };

/**
 * Post scheduled messages whose time has come, as their author. Runs from the
 * cron route with the service role; membership is re-checked at send time so a
 * message never lands somewhere its author has since left.
 */
export async function sendDueScheduledMessages(): Promise<ScheduledRun> {
  const admin = createSupabaseAdminClient();
  const run: ScheduledRun = { due: 0, sent: 0, failed: 0 };
  const { data: due, error } = await admin
    .from("scheduled_messages")
    .select("*")
    .lte("send_at", new Date().toISOString())
    .is("sent_message_id", null)
    .is("failed", null)
    .order("send_at")
    .limit(50);
  if (error) throw new Error(`scheduled_messages: ${error.message}`);
  run.due = due?.length ?? 0;

  for (const row of due ?? []) {
    const fail = async (reason: string) => {
      run.failed += 1;
      await admin.from("scheduled_messages").update({ failed: reason }).eq("id", row.id);
    };
    try {
      const membership = row.channel_id
        ? await admin.from("channel_members").select("user_id", { head: true, count: "exact" }).eq("channel_id", row.channel_id).eq("user_id", row.author_id)
        : await admin.from("conversation_members").select("user_id", { head: true, count: "exact" }).eq("conversation_id", row.conversation_id!).eq("user_id", row.author_id);
      if ((membership.count ?? 0) === 0) {
        await fail("no longer a member");
        continue;
      }
      if (row.channel_id) {
        const { data: ch } = await admin.from("channels").select("is_archived").eq("id", row.channel_id).maybeSingle();
        if (ch?.is_archived) {
          await fail("channel archived");
          continue;
        }
      }

      const { data: message, error: insertError } = await admin
        .from("messages")
        .insert({ channel_id: row.channel_id, conversation_id: row.conversation_id, author_id: row.author_id, content: row.content, content_text: row.content_text })
        .select("id")
        .single();
      if (insertError || !message) {
        await fail(insertError?.message ?? "insert failed");
        continue;
      }

      const { data: mentions } = await admin.rpc("extract_mentions", { p_content: row.content });
      if (mentions?.length) {
        await admin
          .from("mentions")
          .upsert(
            mentions.map((m) => ({ message_id: message.id, user_id: m.user_id, kind: m.kind })),
            { onConflict: "message_id,user_id,kind", ignoreDuplicates: true },
          );
      }
      await admin.from("scheduled_messages").update({ sent_message_id: message.id }).eq("id", row.id);
      run.sent += 1;
      void notifyForMessage(message.id);
    } catch (err) {
      await fail(err instanceof Error ? err.message : String(err));
    }
  }
  return run;
}

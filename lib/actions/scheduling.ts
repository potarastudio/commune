"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isEmptyDoc, toContentText } from "@/lib/utils/tiptap";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const containerSchema = z.object({ kind: z.enum(["channel", "conversation"]), id: uuid });
const future = z.string().datetime().refine((v) => new Date(v).getTime() > Date.now() + 30_000, "Pick a time at least a minute from now.");
const MAX_DAYS = 120;

/** Queue a message for later (§5 Phase 3). The cron route posts it as you when the time comes. */
export async function scheduleMessageAction(input: { container: { kind: "channel" | "conversation"; id: string }; content: unknown; sendAt: string }): Promise<Result<{ id: string }>> {
  const parsed = z.object({ container: containerSchema, content: z.record(z.string(), z.unknown()), sendAt: future }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That couldn't be scheduled." };
  const { container, content, sendAt } = parsed.data;
  if (new Date(sendAt).getTime() > Date.now() + MAX_DAYS * 24 * 60 * 60_000) return { ok: false, error: `Schedule within the next ${MAX_DAYS} days.` };
  if (isEmptyDoc(content)) return { ok: false, error: "Write something first." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const member =
    container.kind === "channel"
      ? await supabase.from("channel_members").select("user_id", { head: true, count: "exact" }).eq("channel_id", container.id).eq("user_id", user.id)
      : await supabase.from("conversation_members").select("user_id", { head: true, count: "exact" }).eq("conversation_id", container.id).eq("user_id", user.id);
  if ((member.count ?? 0) === 0) return { ok: false, error: "You can only schedule messages where you're a member." };

  const { data, error } = await supabase
    .from("scheduled_messages")
    .insert({
      author_id: user.id,
      channel_id: container.kind === "channel" ? container.id : null,
      conversation_id: container.kind === "conversation" ? container.id : null,
      content: content as Json,
      content_text: toContentText(content),
      send_at: sendAt,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("scheduleMessageAction", { code: error?.code, message: error?.message });
    return { ok: false, error: "Couldn't schedule that. Try again." };
  }
  return { ok: true, data: { id: data.id } };
}

export async function cancelScheduledAction(input: { id: string }): Promise<Result> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("scheduled_messages").delete({ count: "exact" }).eq("id", parsed.data.id).is("sent_message_id", null);
  if (error) {
    console.error("cancelScheduledAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't cancel that. Try again." };
  }
  if (count === 0) return { ok: false, error: "That message was already sent." };
  return { ok: true, data: undefined };
}

/** "Remind me about this": a note to yourself, plus a push, when the time comes. */
export async function createReminderAction(input: { messageId: string; remindAt: string }): Promise<Result> {
  const parsed = z.object({ messageId: uuid, remindAt: future }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That couldn't be saved." };
  if (new Date(parsed.data.remindAt).getTime() > Date.now() + MAX_DAYS * 24 * 60 * 60_000) return { ok: false, error: `Pick a time within the next ${MAX_DAYS} days.` };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };
  const { error } = await supabase.from("reminders").insert({ user_id: user.id, message_id: parsed.data.messageId, remind_at: parsed.data.remindAt });
  if (error) {
    console.error("createReminderAction", { code: error.code, message: error.message });
    return { ok: false, error: error.code === "42501" ? "You can't set a reminder on a message you can't read." : "Couldn't set that reminder. Try again." };
  }
  revalidatePath("/activity");
  return { ok: true, data: undefined };
}

export async function cancelReminderAction(input: { id: string }): Promise<Result> {
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("reminders").delete({ count: "exact" }).eq("id", parsed.data.id).is("delivered_at", null);
  if (error) {
    console.error("cancelReminderAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't cancel that reminder. Try again." };
  }
  if (count === 0) return { ok: false, error: "That reminder already fired." };
  revalidatePath("/activity");
  return { ok: true, data: undefined };
}

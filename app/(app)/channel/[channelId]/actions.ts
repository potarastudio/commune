"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addReaction,
  insertChannelMessage,
  markChannelRead,
  removeReaction,
  softDeleteMessage,
  type MessageRow,
} from "@/lib/queries/messages";
import { isEmptyDoc, toContentText } from "@/lib/utils/tiptap";

type Result<T = undefined> = { ok: true; message: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const tiptapDoc = z.object({ type: z.literal("doc") }).passthrough();

function fail(context: string, err: unknown): { ok: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  console.error(context, { message });
  return { ok: false, error: "Something went wrong on our side. Try again." };
}

/** content_text and mentions are derived server-side; the client only sends the document (§7). */
export async function sendMessageAction(input: { channelId: string; content: unknown }): Promise<Result<MessageRow>> {
  const parsed = z.object({ channelId: uuid, content: tiptapDoc }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message couldn't be read." };

  const content = parsed.data.content as Parameters<typeof toContentText>[0] & Record<string, unknown>;
  if (isEmptyDoc(content)) return { ok: false, error: "Message is empty." };
  if (JSON.stringify(content).length > 40_000) return { ok: false, error: "Message is too long." };

  try {
    const supabase = await createSupabaseServerClient();
    const row = await insertChannelMessage(supabase, {
      channelId: parsed.data.channelId,
      content,
      contentText: toContentText(content),
    });
    return { ok: true, message: row };
  } catch (err) {
    return fail("sendMessageAction", err);
  }
}

export async function toggleReactionAction(input: { messageId: string; emoji: string; remove: boolean }): Promise<Result> {
  const parsed = z
    .object({ messageId: uuid, emoji: z.string().min(1).max(64), remove: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "That reaction couldn't be read." };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "You're signed out." };

    if (parsed.data.remove) await removeReaction(supabase, parsed.data.messageId, user.id, parsed.data.emoji);
    else await addReaction(supabase, parsed.data.messageId, user.id, parsed.data.emoji);
    return { ok: true, message: undefined };
  } catch (err) {
    return fail("toggleReactionAction", err);
  }
}

export async function deleteMessageAction(input: { messageId: string }): Promise<Result> {
  const parsed = z.object({ messageId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message couldn't be read." };
  try {
    const supabase = await createSupabaseServerClient();
    await softDeleteMessage(supabase, parsed.data.messageId);
    return { ok: true, message: undefined };
  } catch (err) {
    return fail("deleteMessageAction", err);
  }
}

export async function markChannelReadAction(input: { channelId: string }): Promise<Result> {
  const parsed = z.object({ channelId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown channel." };
  try {
    const supabase = await createSupabaseServerClient();
    await markChannelRead(supabase, parsed.data.channelId);
    return { ok: true, message: undefined };
  } catch (err) {
    return fail("markChannelReadAction", err);
  }
}

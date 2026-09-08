"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addReaction,
  editMessage,
  insertMessage,
  markRead,
  removeReaction,
  setPinned,
  setSaved,
  softDeleteMessage,
  type Container,
  type MessageRow,
} from "@/lib/queries/messages";
import { isEmptyDoc, toContentText } from "@/lib/utils/tiptap";

type Result<T = undefined> = { ok: true; message: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const containerSchema = z.object({ kind: z.enum(["channel", "conversation"]), id: uuid });
const tiptapDoc = z.object({ type: z.literal("doc") }).passthrough();
const attachmentSchema = z.object({
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().max(255),
  size_bytes: z.number().int().nonnegative().max(26214400),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
const attachmentsSchema = z.array(attachmentSchema).max(10).default([]);

function fail(context: string, err: unknown): { ok: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  console.error(context, { message });
  return { ok: false, error: "Something went wrong on our side. Try again." };
}

/** content_text and mentions are derived server-side; the client only sends the document (§7). */
export async function sendMessageAction(input: {
  container: Container;
  content: unknown;
  attachments?: unknown;
}): Promise<Result<MessageRow>> {
  const parsed = z.object({ container: containerSchema, content: tiptapDoc, attachments: attachmentsSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message couldn't be read." };

  const content = parsed.data.content as Parameters<typeof toContentText>[0] & Record<string, unknown>;
  if (isEmptyDoc(content) && parsed.data.attachments.length === 0) return { ok: false, error: "Message is empty." };
  if (JSON.stringify(content).length > 40_000) return { ok: false, error: "Message is too long." };

  try {
    const supabase = await createSupabaseServerClient();
    const row = await insertMessage(supabase, {
      container: parsed.data.container,
      content,
      contentText: toContentText(content),
      attachments: parsed.data.attachments,
    });
    return { ok: true, message: row };
  } catch (err) {
    return fail("sendMessageAction", err);
  }
}

/** A thread reply. The database function copies it into the container when asked ("also send to channel"). */
export async function sendReplyAction(input: {
  container: Container;
  parentId: string;
  content: unknown;
  alsoSendToContainer: boolean;
  attachments?: unknown;
}): Promise<Result<MessageRow>> {
  const parsed = z
    .object({
      container: containerSchema,
      parentId: uuid,
      content: tiptapDoc,
      alsoSendToContainer: z.boolean(),
      attachments: attachmentsSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "That reply couldn't be read." };

  const content = parsed.data.content as Parameters<typeof toContentText>[0] & Record<string, unknown>;
  if (isEmptyDoc(content) && parsed.data.attachments.length === 0) return { ok: false, error: "Reply is empty." };
  if (JSON.stringify(content).length > 40_000) return { ok: false, error: "Reply is too long." };

  try {
    const supabase = await createSupabaseServerClient();
    const row = await insertMessage(supabase, {
      container: parsed.data.container,
      parentId: parsed.data.parentId,
      content,
      contentText: toContentText(content),
      alsoSendToContainer: parsed.data.alsoSendToContainer,
      attachments: parsed.data.attachments,
    });
    return { ok: true, message: row };
  } catch (err) {
    return fail("sendReplyAction", err);
  }
}

export async function toggleReactionAction(input: { messageId: string; emoji: string; remove: boolean }): Promise<Result> {
  const parsed = z.object({ messageId: uuid, emoji: z.string().min(1).max(64), remove: z.boolean() }).safeParse(input);
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

export async function markReadAction(input: { container: Container }): Promise<Result> {
  const parsed = z.object({ container: containerSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown container." };
  try {
    const supabase = await createSupabaseServerClient();
    await markRead(supabase, parsed.data.container);
    return { ok: true, message: undefined };
  } catch (err) {
    return fail("markReadAction", err);
  }
}

export async function editMessageAction(input: { messageId: string; content: unknown }): Promise<Result<MessageRow>> {
  const parsed = z.object({ messageId: uuid, content: tiptapDoc }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That edit couldn't be read." };
  const content = parsed.data.content as Parameters<typeof toContentText>[0] & Record<string, unknown>;
  if (JSON.stringify(content).length > 40_000) return { ok: false, error: "Message is too long." };
  try {
    const supabase = await createSupabaseServerClient();
    const row = await editMessage(supabase, { messageId: parsed.data.messageId, content, contentText: toContentText(content) });
    return { ok: true, message: row };
  } catch (err) {
    return fail("editMessageAction", err);
  }
}

async function currentUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function togglePinAction(input: { messageId: string; pinned: boolean }): Promise<Result> {
  const parsed = z.object({ messageId: uuid, pinned: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message couldn't be read." };
  try {
    const { supabase, userId } = await currentUserId();
    if (!userId) return { ok: false, error: "You're signed out." };
    await setPinned(supabase, parsed.data.messageId, userId, parsed.data.pinned);
    return { ok: true, message: undefined };
  } catch (err) {
    return fail("togglePinAction", err);
  }
}

export async function toggleSaveAction(input: { messageId: string; saved: boolean }): Promise<Result> {
  const parsed = z.object({ messageId: uuid, saved: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message couldn't be read." };
  try {
    const { supabase, userId } = await currentUserId();
    if (!userId) return { ok: false, error: "You're signed out." };
    await setSaved(supabase, parsed.data.messageId, userId, parsed.data.saved);
    return { ok: true, message: undefined };
  } catch (err) {
    return fail("toggleSaveAction", err);
  }
}

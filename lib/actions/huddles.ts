"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { liveParticipantCount } from "@/lib/livekit/server";
import { getActiveHuddle, getHuddleById, type ActiveHuddle } from "@/lib/queries/huddles";
import type { Container } from "@/lib/queries/messages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const containerSchema = z.object({ kind: z.enum(["channel", "conversation"]), id: z.string().uuid() });
const uuid = z.string().uuid();

async function me() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Start a huddle in a container, or return the one already running (§5 Phase 2). */
export async function startHuddleAction(input: { container: Container }): Promise<Result<ActiveHuddle>> {
  const parsed = z.object({ container: containerSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown place for a huddle." };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "You're signed out." };
  const container = parsed.data.container;

  const existing = await getActiveHuddle(supabase, container);
  if (existing) return { ok: true, data: existing };

  const room = `${container.kind === "channel" ? "ch" : "dm"}-${container.id.slice(0, 8)}-${randomBytes(4).toString("hex")}`;
  const { data, error } = await supabase
    .from("huddles")
    .insert({
      channel_id: container.kind === "channel" ? container.id : null,
      conversation_id: container.kind === "conversation" ? container.id : null,
      livekit_room: room,
      started_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    // Someone else started one at the same moment: use theirs.
    if (error.code === "23505") {
      const theirs = await getActiveHuddle(supabase, container);
      if (theirs) return { ok: true, data: theirs };
    }
    console.error("startHuddleAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't start the huddle. Try again." };
  }
  const huddle = await getHuddleById(supabase, data.id);
  return huddle ? { ok: true, data: huddle } : { ok: false, error: "Couldn't start the huddle. Try again." };
}

/** Record that I joined (a fresh row per join; earlier rows for me are closed). */
export async function joinHuddleAction(input: { huddleId: string }): Promise<Result<ActiveHuddle>> {
  const parsed = z.object({ huddleId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown huddle." };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "You're signed out." };

  const now = new Date().toISOString();
  await supabase.from("huddle_participants").update({ left_at: now }).eq("huddle_id", parsed.data.huddleId).eq("user_id", userId).is("left_at", null);
  const { error } = await supabase.from("huddle_participants").insert({ huddle_id: parsed.data.huddleId, user_id: userId, joined_at: now });
  if (error) {
    console.error("joinHuddleAction", { code: error.code, message: error.message });
    return { ok: false, error: /ended|row-level/.test(error.message) ? "That huddle has ended." : "Couldn't join the huddle." };
  }
  const huddle = await getHuddleById(supabase, parsed.data.huddleId);
  return huddle ? { ok: true, data: huddle } : { ok: false, error: "That huddle has ended." };
}

/** Close my participant rows; end the huddle when I was the last one in it. */
export async function leaveHuddleAction(input: { huddleId: string }): Promise<Result<{ ended: boolean }>> {
  const parsed = z.object({ huddleId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown huddle." };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "You're signed out." };
  return finishLeave(supabase, parsed.data.huddleId, userId);
}

async function finishLeave(supabase: Awaited<ReturnType<typeof me>>["supabase"], huddleId: string, userId: string): Promise<Result<{ ended: boolean }>> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("huddle_participants").update({ left_at: now }).eq("huddle_id", huddleId).eq("user_id", userId).is("left_at", null);
  if (error) {
    console.error("leaveHuddleAction", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't leave cleanly." };
  }
  const { count } = await supabase.from("huddle_participants").select("user_id", { count: "exact", head: true }).eq("huddle_id", huddleId).is("left_at", null);
  if ((count ?? 0) > 0) return { ok: true, data: { ended: false } };
  await supabase.from("huddles").update({ ended_at: now }).eq("id", huddleId).is("ended_at", null);
  return { ok: true, data: { ended: true } };
}

/**
 * Reconcile a huddle whose participants may have vanished without a leave
 * (closed laptop, crashed tab): if LiveKit reports an empty room and the
 * huddle is older than a minute, end it. Called when a container page loads.
 */
export async function reconcileHuddle(huddle: ActiveHuddle): Promise<ActiveHuddle | null> {
  const ageMs = Date.now() - new Date(huddle.started_at).getTime();
  if (ageMs < 60_000) return huddle;
  const live = await liveParticipantCount(huddle.livekit_room);
  if (live === null || live > 0) return huddle;
  const { supabase } = await me();
  const now = new Date().toISOString();
  await supabase.from("huddle_participants").update({ left_at: now }).eq("huddle_id", huddle.id).is("left_at", null);
  await supabase.from("huddles").update({ ended_at: now }).eq("id", huddle.id).is("ended_at", null);
  return null;
}

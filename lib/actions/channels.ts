"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CHANNEL_NAME_RE, normaliseChannelName } from "@/lib/utils/channel-name";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; field?: string };

const uuid = z.string().uuid();

function fail(context: string, err: unknown, fallback: string): { ok: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  console.error(context, { message });
  return { ok: false, error: fallback };
}

export async function createChannelAction(input: {
  name: string;
  description?: string;
  isPrivate: boolean;
}): Promise<Result<{ id: string; name: string }>> {
  const parsed = z
    .object({ name: z.string().min(1).max(60), description: z.string().max(1000).optional(), isPrivate: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a channel name of 40 characters or fewer.", field: "name" };
  const name = normaliseChannelName(parsed.data.name);
  if (!CHANNEL_NAME_RE.test(name)) return { ok: false, error: "Use lowercase letters, numbers and dashes.", field: "name" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_channel", {
    p_name: name,
    p_description: parsed.data.description ?? undefined,
    p_is_private: parsed.data.isPrivate,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `#${name} already exists.`, field: "name" };
    return fail("createChannelAction", error, "Couldn't create the channel. Try again.");
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id, name: data.name } };
}

export async function joinChannelAction(input: { channelId: string }): Promise<Result> {
  const parsed = z.object({ channelId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { error } = await supabase
    .from("channel_members")
    .upsert({ channel_id: parsed.data.channelId, user_id: user.id }, { onConflict: "channel_id,user_id", ignoreDuplicates: true });
  if (error) return fail("joinChannelAction", error, "Couldn't join that channel.");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function leaveChannelAction(input: { channelId: string }): Promise<Result> {
  const parsed = z.object({ channelId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { error } = await supabase.from("channel_members").delete().eq("channel_id", parsed.data.channelId).eq("user_id", user.id);
  if (error) {
    if (/#general/.test(error.message)) return { ok: false, error: "Everyone stays in #general." };
    return fail("leaveChannelAction", error, "Couldn't leave that channel.");
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function updateChannelAction(input: { channelId: string; topic?: string | null; description?: string | null }): Promise<Result> {
  const parsed = z
    .object({
      channelId: uuid,
      topic: z.string().max(250, "Keep the topic under 250 characters.").nullable().optional(),
      description: z.string().max(1000, "Keep the description under 1000 characters.").nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That didn't go through. Reload the page and try again." };

  const patch: { topic?: string | null; description?: string | null } = {};
  if (parsed.data.topic !== undefined) patch.topic = parsed.data.topic?.trim() || null;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description?.trim() || null;

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("channels").update(patch, { count: "exact" }).eq("id", parsed.data.channelId);
  if (error) return fail("updateChannelAction", error, "Couldn't save the change.");
  if (count === 0) return { ok: false, error: "Only members can edit this channel." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function addChannelMembersAction(input: { channelId: string; userIds: string[] }): Promise<Result> {
  const parsed = z.object({ channelId: uuid, userIds: z.array(uuid).min(1).max(50) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick at least one person." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("channel_members")
    .upsert(
      parsed.data.userIds.map((user_id) => ({ channel_id: parsed.data.channelId, user_id })),
      { onConflict: "channel_id,user_id", ignoreDuplicates: true },
    );
  if (error) return fail("addChannelMembersAction", error, "Couldn't add those people.");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function setNotificationLevelAction(input: { channelId: string; level: "all" | "mentions" | "muted" }): Promise<Result> {
  const parsed = z.object({ channelId: uuid, level: z.enum(["all", "mentions", "muted"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };

  const { error, count } = await supabase
    .from("channel_members")
    .update({ notification_level: parsed.data.level }, { count: "exact" })
    .eq("channel_id", parsed.data.channelId)
    .eq("user_id", user.id);
  if (error) return fail("setNotificationLevelAction", error, "Couldn't change notifications.");
  if (count === 0) return { ok: false, error: "Join the channel first." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Admin: archive (read-only, hidden from sidebars) or bring back a channel. #general is protected in SQL. */
export async function setChannelArchivedAction(input: { channelId: string; archived: boolean }): Promise<Result> {
  const parsed = z.object({ channelId: uuid, archived: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Reload the page and try again." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out." };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Only admins can archive channels." };

  const { error, count } = await supabase
    .from("channels")
    .update({ is_archived: parsed.data.archived }, { count: "exact" })
    .eq("id", parsed.data.channelId);
  if (error) {
    if (error.code === "42501") return { ok: false, error: "#general can't be archived." };
    return fail("setChannelArchivedAction", error, "Couldn't change the channel.");
  }
  if (count === 0) return { ok: false, error: "That channel doesn't exist." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

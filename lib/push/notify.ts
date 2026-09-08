import "server-only";

import webpush from "web-push";
import { publicEnv, serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inDoNotDisturb } from "./dnd";

/**
 * Web push fan-out for DMs and mentions (§5 Phase 2), run after a message is
 * inserted. Respects per-channel notification level and Do Not Disturb hours
 * in each recipient's own timezone. Uses the service role: recipients are
 * other users, whose subscriptions the sender cannot read.
 *
 * Designed so an Edge Function can call the same routine later.
 */

let configured = false;
function vapid() {
  if (configured) return;
  const env = serverEnv();
  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT ?? "hi@potarastudio.com"}`, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

type Payload = { title: string; body: string; url: string; tag: string };

async function deliver(userIds: string[], payload: Payload) {
  if (userIds.length === 0) return;
  vapid();
  const admin = createSupabaseAdminClient();
  const { data: subs, error } = await admin.from("push_subscriptions").select("id, endpoint, keys").in("user_id", userIds);
  if (error || !subs?.length) return;

  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const keys = s.keys as { p256dh: string; auth: string };
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys }, JSON.stringify(payload), { TTL: 60 * 60 });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("web-push", { status, message: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
}

function excerpt(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || "Sent a file";
}

/** Push for one new message. Safe to call fire-and-forget; never throws. */
export async function notifyForMessage(messageId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: m } = await admin
      .from("messages")
      .select("id, author_id, channel_id, conversation_id, parent_id, content_text, author:profiles!messages_author_id_fkey(display_name), channel:channels(name)")
      .eq("id", messageId)
      .maybeSingle();
    if (!m) return;
    const authorName = (m.author as { display_name: string } | null)?.display_name ?? "Someone";
    const channelName = (m.channel as { name: string } | null)?.name ?? null;
    const base = publicEnv.NEXT_PUBLIC_APP_URL;
    const url = m.channel_id
      ? `${base}/channel/${m.channel_id}?${m.parent_id ? `thread=${m.parent_id}` : `message=${m.id}`}`
      : `${base}/dm/${m.conversation_id}?${m.parent_id ? `thread=${m.parent_id}` : `message=${m.id}`}`;

    // Who might care.
    const candidates = new Map<string, "dm" | "mention">();
    if (m.conversation_id) {
      const { data: members } = await admin.from("conversation_members").select("user_id").eq("conversation_id", m.conversation_id);
      for (const r of members ?? []) if (r.user_id !== m.author_id) candidates.set(r.user_id, "dm");
    }
    const { data: mentions } = await admin.from("mentions").select("user_id, kind").eq("message_id", m.id);
    const broadcast = (mentions ?? []).some((x) => x.kind === "channel" || x.kind === "here");
    for (const x of mentions ?? []) if (x.user_id && x.user_id !== m.author_id) candidates.set(x.user_id, "mention");
    if (broadcast && m.channel_id) {
      const { data: members } = await admin.from("channel_members").select("user_id").eq("channel_id", m.channel_id);
      for (const r of members ?? []) if (r.user_id !== m.author_id && !candidates.has(r.user_id)) candidates.set(r.user_id, "mention");
    }
    if (candidates.size === 0) return;

    // Filter by level (channels only) and DND.
    const ids = [...candidates.keys()];
    const [{ data: profiles }, { data: levels }] = await Promise.all([
      admin.from("profiles").select("id, timezone, dnd_start, dnd_end").in("id", ids),
      m.channel_id
        ? admin.from("channel_members").select("user_id, notification_level").eq("channel_id", m.channel_id).in("user_id", ids)
        : Promise.resolve({ data: [] as { user_id: string; notification_level: string }[] }),
    ]);
    const levelOf = new Map((levels ?? []).map((l) => [l.user_id, l.notification_level]));
    const recipients = (profiles ?? [])
      .filter((p) => !inDoNotDisturb(p))
      .filter((p) => !m.channel_id || levelOf.get(p.id) !== "muted")
      .map((p) => p.id);
    if (recipients.length === 0) return;

    const title = m.conversation_id ? authorName : `${authorName} in #${channelName ?? "channel"}`;
    await deliver(recipients, { title, body: excerpt(m.content_text), url, tag: m.conversation_id ?? m.channel_id ?? m.id });
  } catch (err) {
    console.error("notifyForMessage", { message: err instanceof Error ? err.message : String(err) });
  }
}

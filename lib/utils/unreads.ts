import type { Container } from "@/lib/queries/messages";

/** Pure helpers for unread counts, shared by server and client code. */
export type UnreadEntry = { channel_id: string | null; conversation_id: string | null; unread: number; has_mention: boolean };
export type UnreadMap = Record<string, { unread: number; has_mention: boolean }>;

export const unreadKeyFor = (c: Container) => `${c.kind}:${c.id}`;

export function toUnreadMap(rows: UnreadEntry[]): UnreadMap {
  const map: UnreadMap = {};
  for (const r of rows) {
    const key = r.channel_id ? `channel:${r.channel_id}` : r.conversation_id ? `conversation:${r.conversation_id}` : null;
    if (key) map[key] = { unread: r.unread, has_mention: r.has_mention };
  }
  return map;
}

/**
 * What a list row shows for its unreads, by the channel's notification level:
 * muted shows nothing, "mentions" only bolds for a mention, "all" bolds and
 * counts. The sidebar and the phone's lists read the same rule.
 */
export function unreadBadge(
  unreads: UnreadMap,
  key: string,
  level: "all" | "mentions" | "muted" = "all",
): { bold: boolean; count: number; mention: boolean } {
  const u = unreads[key];
  if (!u || u.unread === 0 || level === "muted") return { bold: false, count: 0, mention: false };
  if (level === "mentions" && !u.has_mention) return { bold: false, count: 0, mention: false };
  return { bold: true, count: u.unread, mention: u.has_mention };
}

/** Conversations and channels with an unread mention, for the Activity badge. Muted channels never count. */
export function mentionConversationCount(unreads: UnreadMap, mutedChannelIds: string[]): number {
  const muted = new Set(mutedChannelIds.map((id) => `channel:${id}`));
  return Object.entries(unreads).filter(([key, u]) => u.has_mention && u.unread > 0 && !muted.has(key)).length;
}

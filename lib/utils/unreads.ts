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

import type { NotificationLevel } from "@/lib/queries/channels";

/**
 * Who a new message is worth interrupting, shared by the in-app notifier and
 * the push fan-out so both obey the same words Settings uses:
 *
 *   All new messages — every message in every channel you have joined
 *   Mentions        — only @you, @channel and @here; DMs always come through
 *   Nothing         — the channel goes quiet; DMs still reach you
 *
 * "All new messages" is the default a channel is joined with, and used to
 * notify nobody: channel messages were dropped and only DMs and mentions ever
 * announced anything.
 */
export type NotifyReason = "dm" | "mention" | "message";

type NewMessage = { channel_id: string | null; conversation_id: string | null; author_id: string };
type LevelOf = (channelId: string) => NotificationLevel | undefined;

/** Why this new message should announce itself to `meId`, or null to stay quiet. */
export function reasonForMessage(row: NewMessage, meId: string, levelOf: LevelOf): NotifyReason | null {
  if (row.author_id === meId) return null;
  if (row.conversation_id) return "dm";
  if (!row.channel_id) return null;
  // An unknown channel is one this person has not joined; public channels are
  // readable, so their messages arrive even then.
  return levelOf(row.channel_id) === "all" ? "message" : null;
}

/** A mention reaches you in every channel you have joined, unless you muted it. */
export function mentionAnnounces(channelId: string | null, levelOf: LevelOf): boolean {
  if (!channelId) return true;
  const level = levelOf(channelId);
  return level !== undefined && level !== "muted";
}

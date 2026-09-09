import "server-only";

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { serverEnv } from "@/lib/env";

/** LiveKit server helpers (§7): tokens are minted here only, never in the client. */

function httpUrl(): string {
  return serverEnv().LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export function roomService(): RoomServiceClient {
  const env = serverEnv();
  return new RoomServiceClient(httpUrl(), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

/** A join token for one huddle room. TTL is short; the client reconnects with a fresh one if needed. */
export async function mintJoinToken(input: { room: string; identity: string; name: string; avatarUrl: string | null }): Promise<string> {
  const env = serverEnv();
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: input.identity,
    name: input.name,
    ttl: "2h",
    metadata: JSON.stringify({ avatar_url: input.avatarUrl }),
  });
  token.addGrant({ room: input.room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  return token.toJwt();
}

/** How many people LiveKit currently has in the room; null when LiveKit can't be reached. */
export async function liveParticipantCount(room: string): Promise<number | null> {
  try {
    const list = await roomService().listParticipants(room);
    return list.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A room that never had anyone connected (or has closed) reports not found.
    if (/not found|404/i.test(message)) return 0;
    console.warn("liveParticipantCount", { room, message });
    return null;
  }
}

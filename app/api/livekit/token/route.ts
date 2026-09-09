import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { mintJoinToken } from "@/lib/livekit/server";
import { getHuddleById } from "@/lib/queries/huddles";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Mint a LiveKit join token for a huddle (§7). The huddle is fetched with the
 * caller's own session, so RLS decides whether they may see it: no access to
 * the channel or conversation, no token.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parsed = z.string().uuid().safeParse(request.nextUrl.searchParams.get("huddle"));
  if (!parsed.success) return NextResponse.json({ error: "Unknown huddle." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) return NextResponse.json({ error: "Signed out." }, { status: 401 });

  const huddle = await getHuddleById(supabase, parsed.data);
  if (!huddle) return NextResponse.json({ error: "You can't join that huddle." }, { status: 403 });
  if (huddle.ended_at) return NextResponse.json({ error: "That huddle has ended." }, { status: 410 });

  const token = await mintJoinToken({
    room: huddle.livekit_room,
    identity: profile.id,
    name: profile.display_name,
    avatarUrl: profile.avatar_url,
  });
  return NextResponse.json({ token, url: serverEnv().LIVEKIT_URL, room: huddle.livekit_room }, { headers: { "Cache-Control": "no-store" } });
}

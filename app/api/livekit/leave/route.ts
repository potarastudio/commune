import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { leaveHuddleAction } from "@/lib/actions/huddles";

/**
 * Leave on tab close. navigator.sendBeacon() posts here with same-origin
 * cookies, so the participant row is closed even when the page is gone.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    const text = await request.text().catch(() => "");
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  const parsed = z.object({ huddleId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Unknown huddle." }, { status: 400 });
  const result = await leaveHuddleAction({ huddleId: parsed.data.huddleId });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

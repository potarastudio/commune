import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runMentionDigest } from "@/lib/email/digest";
import { serverEnv } from "@/lib/env";

/**
 * Trigger for the missed-mentions digest. pg_cron calls this every 5 minutes
 * with the shared CRON_SECRET (README → Mention digest). `?dry=1` reports who
 * would be emailed without sending anything.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!serverEnv().CRON_SECRET) return NextResponse.json({ error: "Digest isn't configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await runMentionDigest({ dryRun: request.nextUrl.searchParams.get("dry") === "1" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("cron/digest", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Digest failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

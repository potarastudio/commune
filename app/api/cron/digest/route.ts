import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deliverDueReminders } from "@/lib/cron/reminders";
import { sendDueScheduledMessages } from "@/lib/cron/scheduled";
import { runMentionDigest } from "@/lib/email/digest";
import { serverEnv } from "@/lib/env";

/**
 * The app's minute tick. pg_cron calls this with the shared CRON_SECRET
 * (README → Mention digest) and it runs everything time-based: scheduled
 * messages, reminders, and the missed-mentions digest. `?dry=1` previews the
 * digest without sending anything (scheduled and reminders still run).
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
    const settled = await Promise.allSettled([
      sendDueScheduledMessages(),
      deliverDueReminders(),
      runMentionDigest({ dryRun: request.nextUrl.searchParams.get("dry") === "1" }),
    ]);
    const [scheduled, reminders, digest] = settled.map((s) => (s.status === "fulfilled" ? s.value : { error: s.reason instanceof Error ? s.reason.message : String(s.reason) }));
    for (const s of settled) if (s.status === "rejected") console.error("cron/digest job", { message: s.reason instanceof Error ? s.reason.message : String(s.reason) });
    return NextResponse.json({ scheduled, reminders, digest }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("cron/digest", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Digest failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

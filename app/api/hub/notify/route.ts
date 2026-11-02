import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { hubNotificationDoc, parseHubNotification } from "@/lib/hub/notification";
import { serverEnv } from "@/lib/env";
import { notifyForMessage } from "@/lib/push/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toContentText } from "@/lib/utils/tiptap";

/**
 * Notifications from Potara Hub (the Hub's spec, section 7; README → Potara
 * Hub notifications). The Hub posts { id, recipientEmail, title, body, url }
 * with the shared HUB_WEBHOOK_SECRET, and that person gets a DM from the
 * Potara Hub account, pushed like any DM. The Hub tries again when it gets no
 * answer, so `id` is remembered: a repeat answers with the first message.
 *
 * The answers are the contract the Hub is built against, so keep them:
 *   201 { messageId }  posted              200 { messageId }  that id was already posted
 *   400 invalid_json, invalid_body or invalid_url
 *   401 unauthorized                       404 unknown_recipient
 *   503 not_configured                     500 post_failed, which the Hub tries again
 * Errors are { error: code }; the Hub logs a code only when it is short and
 * lowercase, ^[a-z][a-z0-9_]{0,63}$.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function answer(body: { messageId: string } | { error: string }, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const secret = serverEnv().HUB_WEBHOOK_SECRET;
  if (!secret) return answer({ error: "not_configured" }, 503);
  if (!authorized(request, secret)) return answer({ error: "unauthorized" }, 401);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return answer({ error: "invalid_json" }, 400);
  }
  const parsed = parseHubNotification(json);
  if (!parsed.ok) {
    console.warn("hub/notify refused", { error: parsed.error, fields: parsed.fields });
    return answer({ error: parsed.error }, 400);
  }

  const { id, recipientEmail } = parsed.notification;
  const content = hubNotificationDoc(parsed.notification);
  try {
    const { data, error } = await createSupabaseAdminClient()
      .rpc("post_hub_notification", {
        p_id: id,
        p_recipient_email: recipientEmail,
        p_content: content,
        p_content_text: toContentText(content),
      })
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      console.warn("hub/notify unknown recipient", { id });
      return answer({ error: "unknown_recipient" }, 404);
    }
    if (data.posted) after(() => notifyForMessage(data.message_id));
    return answer({ messageId: data.message_id }, data.posted ? 201 : 200);
  } catch (err) {
    console.error("hub/notify", { id, message: err instanceof Error ? err.message : String(err) });
    return answer({ error: "post_failed" }, 500);
  }
}

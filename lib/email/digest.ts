import "server-only";

import { Resend } from "resend";
import { publicEnv, serverEnv } from "@/lib/env";
import { inDoNotDisturb } from "@/lib/push/dnd";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildDigestEmail, type DigestMention } from "./digest-format";

/**
 * Missed-mentions digest (§5 Phase 2). Postgres decides who is due
 * (pending_mention_digest: away, unread, older than 15 min, not yet sent);
 * this sends one email per person and logs each mention so it never repeats.
 * Runs from app/api/cron/digest, triggered by pg_cron every 5 minutes.
 */

export type DigestRun = {
  dryRun: boolean;
  recipients: number;
  sent: number;
  mentions: number;
  skippedDnd: number;
  failed: number;
  preview: { to: string; subject: string; mentions: number }[];
};

type PendingRow = DigestMention & {
  user_id: string;
  email: string;
  display_name: string;
  timezone: string;
  dnd_start: string | null;
  dnd_end: string | null;
};

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || "Commune <onboarding@resend.dev>";
}

export async function runMentionDigest(opts: { dryRun?: boolean } = {}): Promise<DigestRun> {
  const dryRun = Boolean(opts.dryRun);
  const run: DigestRun = { dryRun, recipients: 0, sent: 0, mentions: 0, skippedDnd: 0, failed: 0, preview: [] };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("pending_mention_digest");
  if (error) throw new Error(`pending_mention_digest: ${error.message}`);
  const rows = (data ?? []) as PendingRow[];
  if (rows.length === 0) return run;

  const byUser = new Map<string, PendingRow[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  run.recipients = byUser.size;

  const key = serverEnv().RESEND_API_KEY;
  const resend = key && key !== "placeholder" ? new Resend(key) : null;
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;

  for (const [userId, mentions] of byUser) {
    const me = mentions[0];
    if (inDoNotDisturb(me)) {
      run.skippedDnd += 1;
      continue; // stays pending; sent once quiet hours end
    }
    const email = buildDigestEmail({ recipientName: me.display_name, timezone: me.timezone, mentions, appUrl });
    run.preview.push({ to: me.email, subject: email.subject, mentions: mentions.length });
    if (dryRun) continue;
    if (!resend) {
      run.failed += 1;
      continue;
    }
    try {
      const { error: sendError } = await resend.emails.send({ from: fromAddress(), to: me.email, subject: email.subject, text: email.text, html: email.html });
      if (sendError) {
        run.failed += 1;
        console.error("mention digest send", { userId, message: sendError.message, name: sendError.name });
        continue;
      }
      const { error: logError } = await admin
        .from("mention_digest_log")
        .upsert(mentions.map((m) => ({ mention_id: m.mention_id, user_id: userId })), { onConflict: "mention_id,user_id", ignoreDuplicates: true });
      if (logError) console.error("mention digest log", { userId, message: logError.message });
      run.sent += 1;
      run.mentions += mentions.length;
    } catch (err) {
      run.failed += 1;
      console.error("mention digest send", { userId, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return run;
}

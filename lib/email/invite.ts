import "server-only";

import { Resend } from "resend";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Invitation email via Resend (§2). When the API key is the local placeholder
 * or sending fails, the caller still allowlists the address and shows a link,
 * so a missing key never blocks an invite.
 */
export function inviteLink(): string {
  return `${publicEnv.NEXT_PUBLIC_APP_URL}/login`;
}

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || "Commune <onboarding@resend.dev>";
}

export async function sendInviteEmail(input: { to: string; inviterName: string }): Promise<{ sent: boolean; reason?: string }> {
  const key = serverEnv().RESEND_API_KEY;
  if (!key || key === "placeholder") return { sent: false, reason: "Email sending isn't set up yet." };

  const link = inviteLink();
  const subject = `${input.inviterName} invited you to Commune`;
  const text = [
    `${input.inviterName} invited you to Commune, Potara Studio's team chat.`,
    "",
    `Sign in with Google using this address (${input.to}):`,
    link,
    "",
    "Only invited addresses can get in, so use exactly this one.",
  ].join("\n");
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1b1b1a">
      <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6e6e69;margin:0 0 8px">Potara Studio</p>
      <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(input.inviterName)} invited you to Commune</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Commune is where the studio talks: channels, threads, files and huddles.</p>
      <a href="${link}" style="display:inline-block;background:#d9591b;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px">Open Commune</a>
      <p style="font-size:13px;line-height:1.5;color:#6e6e69;margin:24px 0 0">Sign in with Google using <strong>${escapeHtml(input.to)}</strong>. Only invited addresses can get in, so use exactly this one.</p>
    </div>`;

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({ from: fromAddress(), to: input.to, subject, text, html });
    if (error) {
      console.error("sendInviteEmail", { message: error.message, name: error.name });
      return { sent: false, reason: "The email service refused the message." };
    }
    return { sent: true };
  } catch (err) {
    console.error("sendInviteEmail", { message: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "The email service couldn't be reached." };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

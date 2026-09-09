/**
 * Pure formatting for the missed-mentions email. No I/O, so it is unit-tested
 * and the sender (lib/email/digest.ts) stays thin.
 */

export type DigestMention = {
  mention_id: string;
  kind: "user" | "channel";
  message_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  parent_id: string | null;
  content_text: string;
  created_at: string;
  author_name: string;
  channel_name: string | null;
};

export type DigestEmail = { subject: string; text: string; html: string };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Deep link into the message, opening its thread when it is a reply. */
export function mentionUrl(base: string, m: Pick<DigestMention, "message_id" | "channel_id" | "conversation_id" | "parent_id">): string {
  const path = m.channel_id ? `/channel/${m.channel_id}` : `/dm/${m.conversation_id}`;
  const query = m.parent_id ? `thread=${m.parent_id}` : `message=${m.message_id}`;
  return `${base}${path}?${query}`;
}

export function excerpt(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Sent a file";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** "#design" or "a direct message". */
export function placeLabel(m: Pick<DigestMention, "channel_name" | "conversation_id">): string {
  return m.channel_name ? `#${m.channel_name}` : "a direct message";
}

function timeLabel(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * One email per recipient per run. A single mention gets a specific subject;
 * several get a count. Ordered oldest first, like reading a channel.
 */
export function buildDigestEmail(input: {
  recipientName: string;
  timezone: string;
  mentions: DigestMention[];
  appUrl: string;
}): DigestEmail {
  const items = [...input.mentions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = items[0];
  const subject =
    items.length === 1
      ? first.kind === "channel"
        ? `${first.author_name} posted to @channel in ${placeLabel(first)}`
        : `${first.author_name} mentioned you in ${placeLabel(first)}`
      : `${items.length} unread mentions in Commune`;

  const firstName = input.recipientName.split(" ")[0] || input.recipientName;
  const intro = items.length === 1 ? "You were mentioned while you were away." : `You were mentioned ${items.length} times while you were away.`;

  const text = [
    `Hi ${firstName},`,
    "",
    intro,
    "",
    ...items.flatMap((m) => [
      `${m.author_name} in ${placeLabel(m)} · ${timeLabel(m.created_at, input.timezone)}`,
      `  ${excerpt(m.content_text)}`,
      `  ${mentionUrl(input.appUrl, m)}`,
      "",
    ]),
    "You get this because you were away from Commune for a while. Turn it off in Settings → Notifications.",
    `${input.appUrl}/settings`,
  ].join("\n");

  const rows = items
    .map(
      (m) => `
      <tr>
        <td style="padding:14px 0;border-top:1px solid #e8e6e1;vertical-align:top">
          <p style="margin:0 0 4px;font-size:13px;color:#6e6e69">
            <strong style="color:#1b1b1a">${escapeHtml(m.author_name)}</strong>
            in ${escapeHtml(placeLabel(m))}${m.parent_id ? " · in a thread" : ""}
            <span style="float:right">${escapeHtml(timeLabel(m.created_at, input.timezone))}</span>
          </p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#1b1b1a">${escapeHtml(excerpt(m.content_text))}</p>
          <a href="${mentionUrl(input.appUrl, m)}" style="font-size:13px;font-weight:600;color:#d64b0c;text-decoration:none">Open in Commune →</a>
        </td>
      </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1b1b1a">
      <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6e6e69;margin:0 0 8px">Potara Studio</p>
      <h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(subject)}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 12px;color:#6e6e69">${escapeHtml(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="font-size:12px;line-height:1.5;color:#6e6e69;margin:28px 0 0;border-top:1px solid #e8e6e1;padding-top:16px">
        You get this because you were away from Commune for a while.
        <a href="${input.appUrl}/settings" style="color:#6e6e69">Turn it off in Settings</a>.
      </p>
    </div>`;

  return { subject, text, html };
}

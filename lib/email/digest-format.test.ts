import { describe, expect, it } from "vitest";
import { buildDigestEmail, excerpt, mentionUrl, type DigestMention } from "./digest-format";

const base: DigestMention = {
  mention_id: "m1",
  kind: "user",
  message_id: "00000000-0000-4000-8000-000000000010",
  channel_id: "00000000-0000-4000-8000-000000000020",
  conversation_id: null,
  parent_id: null,
  content_text: "@hakim can you check the hero spacing before the client call?",
  created_at: "2026-09-09T03:10:00.000Z",
  author_name: "Sari Wijaya",
  channel_name: "design",
};

describe("buildDigestEmail", () => {
  it("names the author and place when there is one mention", () => {
    const e = buildDigestEmail({ recipientName: "Hakim Haiman", timezone: "Asia/Jakarta", mentions: [base], appUrl: "https://commune.test" });
    expect(e.subject).toBe("Sari Wijaya mentioned you in #design");
    expect(e.text).toContain("Hi Hakim,");
    expect(e.text).toContain("10:10"); // 03:10Z in Jakarta
    expect(e.text).toContain("https://commune.test/channel/00000000-0000-4000-8000-000000000020?message=00000000-0000-4000-8000-000000000010");
    expect(e.html).toContain("Open in Commune");
  });

  it("counts several mentions and lists them oldest first", () => {
    const later: DigestMention = { ...base, mention_id: "m2", message_id: "later", created_at: "2026-09-09T04:00:00.000Z", author_name: "Raka Pratama", content_text: "second" };
    const e = buildDigestEmail({ recipientName: "Hakim", timezone: "Asia/Jakarta", mentions: [later, base], appUrl: "https://commune.test" });
    expect(e.subject).toBe("2 unread mentions in Commune");
    expect(e.text.indexOf("Sari Wijaya")).toBeLessThan(e.text.indexOf("Raka Pratama"));
  });

  it("describes @channel posts and direct messages differently", () => {
    const dm: DigestMention = { ...base, kind: "channel", channel_id: null, channel_name: null, conversation_id: "c1" };
    const e = buildDigestEmail({ recipientName: "Hakim", timezone: "Asia/Jakarta", mentions: [dm], appUrl: "https://commune.test" });
    expect(e.subject).toBe("Sari Wijaya posted to @channel in a direct message");
  });

  it("escapes HTML in message text", () => {
    const e = buildDigestEmail({ recipientName: "Hakim", timezone: "Asia/Jakarta", mentions: [{ ...base, content_text: "<b>bold</b>" }], appUrl: "https://x" });
    expect(e.html).not.toContain("<b>bold</b>");
    expect(e.html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });
});

describe("mentionUrl and excerpt", () => {
  it("opens the thread for replies", () => {
    expect(mentionUrl("https://x", { ...base, parent_id: "p1" })).toBe(`https://x/channel/${base.channel_id}?thread=p1`);
    expect(mentionUrl("https://x", { ...base, channel_id: null, conversation_id: "c1" })).toBe("https://x/dm/c1?message=00000000-0000-4000-8000-000000000010");
  });

  it("collapses whitespace and truncates", () => {
    expect(excerpt("  a \n\n b  ")).toBe("a b");
    expect(excerpt("x".repeat(200), 20)).toHaveLength(20);
    expect(excerpt("")).toBe("Sent a file");
  });
});

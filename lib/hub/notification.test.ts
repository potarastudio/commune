import { describe, expect, it } from "vitest";
import { toContentText } from "@/lib/utils/tiptap";
import { hubUrl, isHubUrl } from "./links";
import { HUB_LINK_LABEL, hubNotificationDoc, parseHubNotification } from "./notification";

/** A notification as the Hub sends it (its commune.test.ts, with the real Hub origin). */
const SENT = {
  id: "00000000-0000-4000-8000-000000002001",
  recipientEmail: "int.bd@potarastudio.com",
  title: "Lead baru belum direspon",
  body: "E2E Klien Satu · website",
  url: "https://hub.potarastudio.com/leads/00000000-0000-4000-8000-000000002002",
};

describe("parseHubNotification", () => {
  it("takes what the Hub sends", () => {
    expect(parseHubNotification(SENT)).toEqual({ ok: true, notification: SENT });
  });

  it("lowercases the email and puts the title on one line", () => {
    const parsed = parseHubNotification({ ...SENT, recipientEmail: " Int.BD@PotaraStudio.com ", title: "  Lead baru\n  belum direspon " });
    expect(parsed).toMatchObject({ ok: true, notification: { recipientEmail: "int.bd@potarastudio.com", title: "Lead baru belum direspon" } });
  });

  it("allows an empty or missing body", () => {
    expect(parseHubNotification({ ...SENT, body: "" })).toMatchObject({ ok: true, notification: { body: "" } });
    const withoutBody = { id: SENT.id, recipientEmail: SENT.recipientEmail, title: SENT.title, url: SENT.url };
    expect(parseHubNotification(withoutBody)).toMatchObject({ ok: true, notification: { body: "" } });
  });

  it("counts the title's 200 characters the way the Hub does, so emoji count once", () => {
    expect(parseHubNotification({ ...SENT, title: "🔥".repeat(200) }).ok).toBe(true);
    expect(parseHubNotification({ ...SENT, title: "a".repeat(201) })).toMatchObject({ ok: false, error: "invalid_body", fields: ["title"] });
  });

  it("refuses a body that is missing its parts or has them wrong", () => {
    for (const bad of [
      null,
      "text",
      { ...SENT, id: "not-a-uuid" },
      { ...SENT, recipientEmail: "nobody" },
      { ...SENT, title: "   " },
      { ...SENT, title: 42 },
      { ...SENT, body: "x".repeat(4001) },
      { id: SENT.id, recipientEmail: SENT.recipientEmail, body: SENT.body, url: SENT.url },
    ]) {
      expect(parseHubNotification(bad)).toMatchObject({ ok: false, error: "invalid_body" });
    }
  });

  it("names the fields that were wrong, for the log", () => {
    expect(parseHubNotification({ ...SENT, id: "x", recipientEmail: "y" })).toMatchObject({ fields: ["id", "recipientEmail"] });
  });

  it("refuses a link anywhere but the Hub", () => {
    for (const url of [
      "http://hub.potarastudio.com/leads/1",
      "https://hub.potarastudio.com.evil.example/leads/1",
      "https://hub.potarastudio.com@evil.example/leads/1",
      "https://user:pass@hub.potarastudio.com/leads/1",
      "https://hub.potarastudio.com:8443/leads/1",
      "https://commune.potarastudio.com/dm/1",
      "/leads/1",
      "javascript:alert(1)",
    ]) {
      expect(parseHubNotification({ ...SENT, url })).toEqual({ ok: false, error: "invalid_url", fields: ["url"] });
    }
  });

  it("keeps a Hub link, normalised", () => {
    expect(parseHubNotification({ ...SENT, url: "https://HUB.potarastudio.com:443/leads/1?tab=notes#top" })).toMatchObject({
      notification: { url: "https://hub.potarastudio.com/leads/1?tab=notes#top" },
    });
  });
});

describe("hubNotificationDoc", () => {
  it("is the title in bold, the body, then the link, like the Hub's email", () => {
    expect(hubNotificationDoc(SENT)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: SENT.title, marks: [{ type: "bold" }] }] },
        { type: "paragraph", content: [{ type: "text", text: SENT.body }] },
        { type: "paragraph", content: [{ type: "text", text: HUB_LINK_LABEL, marks: [{ type: "link", attrs: { href: SENT.url } }] }] },
      ],
    });
  });

  it("keeps the body's line breaks, blank lines included", () => {
    const doc = hubNotificationDoc({ ...SENT, body: "Klien: PT Satu\r\nSumber: website\n\nCatatan: segera" });
    expect(doc.content?.[1]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Klien: PT Satu" },
        { type: "hardBreak" },
        { type: "text", text: "Sumber: website" },
        { type: "hardBreak" },
        { type: "hardBreak" },
        { type: "text", text: "Catatan: segera" },
      ],
    });
  });

  it("leaves out an empty body", () => {
    expect(hubNotificationDoc({ ...SENT, body: " \n " }).content).toHaveLength(2);
  });

  it("reads as text the way search and push see it", () => {
    expect(toContentText(hubNotificationDoc(SENT))).toBe(`${SENT.title}\n${SENT.body}\n${HUB_LINK_LABEL}`);
  });
});

describe("hub links", () => {
  it("knows a Hub page from anything else", () => {
    expect(isHubUrl("https://hub.potarastudio.com/")).toBe(true);
    expect(isHubUrl("https://hub.potarastudio.com/leads/1")).toBe(true);
    expect(isHubUrl("https://potarastudio.com/hub")).toBe(false);
    expect(isHubUrl("not a url")).toBe(false);
    expect(hubUrl("https://hub.potarastudio.com")).toBe("https://hub.potarastudio.com/");
  });
});

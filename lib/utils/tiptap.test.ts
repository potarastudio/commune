import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { docFromText, extractLinks, extractMentions, isEmptyDoc, toContentText, toPlainText } from "./tiptap";

const HAKIM = "00000000-0000-4000-8000-000000000001";
const SARI = "00000000-0000-4000-8000-000000000002";

const mention = (id: string, label = id): JSONContent => ({ type: "mention", attrs: { id, label } });
const text = (t: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: t, marks });
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

describe("toPlainText / toContentText", () => {
  it("renders a simple paragraph", () => {
    expect(toContentText(docFromText("hello world"))).toBe("hello world");
  });

  it("joins block nodes with newlines and drops marks", () => {
    const d = doc(
      p(text("bold", [{ type: "bold" }]), text(" and "), text("code", [{ type: "code" }])),
      p(text("second")),
      { type: "codeBlock", attrs: { language: "css" }, content: [text("--radius: 8px;")] },
    );
    expect(toContentText(d)).toBe("bold and code\nsecond\n--radius: 8px;");
  });

  it("renders hard breaks, mentions and emoji", () => {
    const d = doc(
      p(text("hey "), mention(HAKIM, "hakim"), { type: "hardBreak" }, text("look "), {
        type: "emoji",
        attrs: { name: "fire", emoji: "🔥" },
      }),
    );
    expect(toContentText(d)).toBe("hey @hakim\nlook 🔥");
  });

  it("renders @channel and @here mentions by label", () => {
    expect(toContentText(doc(p(mention("channel"), text(" standup in 5"))))).toBe("@channel standup in 5");
  });

  it("renders list items on separate lines", () => {
    const d = doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [p(text("one"))] },
        { type: "listItem", content: [p(text("two"))] },
      ],
    });
    expect(toContentText(d)).toBe("one\n\ntwo");
  });

  it("returns an empty string for empty or malformed input", () => {
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText(null)).toBe("");
    expect(toContentText(doc(p()))).toBe("");
    expect(toContentText({ type: "doc" })).toBe("");
  });
});

describe("extractMentions", () => {
  it("extracts user mentions by profile uuid", () => {
    const d = doc(p(mention(HAKIM, "hakim"), text(" and "), mention(SARI, "sari")));
    expect(extractMentions(d)).toEqual([
      { kind: "user", userId: HAKIM },
      { kind: "user", userId: SARI },
    ]);
  });

  it("extracts @channel and @here", () => {
    const d = doc(p(mention("channel"), text(" "), mention("here")));
    expect(extractMentions(d)).toEqual([
      { kind: "channel", userId: null },
      { kind: "here", userId: null },
    ]);
  });

  it("deduplicates repeated mentions and normalises uuid case", () => {
    const d = doc(p(mention(HAKIM), mention(HAKIM.toUpperCase()), mention("channel"), mention("channel")));
    expect(extractMentions(d)).toEqual([
      { kind: "user", userId: HAKIM },
      { kind: "channel", userId: null },
    ]);
  });

  it("ignores mentions with invalid ids", () => {
    const d = doc(p(mention("not-a-uuid", "x"), mention("", ""), { type: "mention", attrs: {} }));
    expect(extractMentions(d)).toEqual([]);
  });

  it("finds mentions nested inside lists and quotes", () => {
    const d = doc({
      type: "blockquote",
      content: [{ type: "bulletList", content: [{ type: "listItem", content: [p(mention(SARI))] }] }],
    });
    expect(extractMentions(d)).toEqual([{ kind: "user", userId: SARI }]);
  });

  it("returns nothing for text that merely looks like a mention", () => {
    expect(extractMentions(docFromText("@hakim is not a mention node"))).toEqual([]);
  });
});

describe("isEmptyDoc", () => {
  it("treats whitespace-only and empty paragraphs as empty", () => {
    expect(isEmptyDoc(docFromText("   "))).toBe(true);
    expect(isEmptyDoc(doc(p()))).toBe(true);
    expect(isEmptyDoc(undefined)).toBe(true);
  });

  it("treats mentions, emoji and images as content", () => {
    expect(isEmptyDoc(doc(p(mention("here"))))).toBe(false);
    expect(isEmptyDoc(doc(p({ type: "emoji", attrs: { emoji: "🎉" } })))).toBe(false);
    expect(isEmptyDoc(doc({ type: "image", attrs: { src: "x" } }))).toBe(false);
  });
});

describe("extractLinks", () => {
  it("finds link marks and bare URLs, dedupes, strips hashes and trailing punctuation", () => {
    const d = doc(
      p(text("see ", []), text("the site", [{ type: "link", attrs: { href: "https://potara.studio/work#top" } }]), text(" and https://potara.studio/work, plus http://example.com/a).")),
      { type: "codeBlock", content: [text("https://ignored.example")] },
    );
    expect(extractLinks(d)).toEqual(["https://potara.studio/work", "http://example.com/a"]);
  });
  it("ignores non-http schemes and caps the count", () => {
    const d = doc(p(text("mailto:hi@potarastudio.com https://a.com https://b.com https://c.com https://d.com")));
    expect(extractLinks(d, 2)).toEqual(["https://a.com/", "https://b.com/"]);
    expect(extractLinks(undefined)).toEqual([]);
  });
});

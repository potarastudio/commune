import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { JSONContent } from "@tiptap/core";
import { renderContent, sanitizeHref } from "./render";

const html = (doc: JSONContent) => renderToStaticMarkup(<>{renderContent(doc)}</>);
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const t = (text: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text, marks });

describe("renderContent", () => {
  it("renders marks", () => {
    const out = html(doc(p(t("a", [{ type: "bold" }]), t("b", [{ type: "italic" }]), t("c", [{ type: "strike" }]), t("d", [{ type: "code" }]))));
    expect(out).toContain("<strong>a</strong>");
    expect(out).toContain("<em>b</em>");
    expect(out).toContain("<s>c</s>");
    expect(out).toMatch(/<code[^>]*>d<\/code>/);
  });

  it("renders safe links with noopener and drops javascript: links", () => {
    const safe = html(doc(p(t("site", [{ type: "link", attrs: { href: "https://potara.studio/x?y=1" } }]))));
    expect(safe).toContain('href="https://potara.studio/x?y=1"');
    expect(safe).toContain('rel="noopener noreferrer"');
    expect(safe).toContain('target="_blank"');

    const evil = html(doc(p(t("click", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))));
    expect(evil).not.toContain("<a");
    expect(evil).toContain("click");
  });

  it("escapes text content", () => {
    expect(html(doc(p(t("<img src=x onerror=alert(1)>"))))).not.toContain("<img");
  });

  it("renders mentions as chips with the id on a data attribute", () => {
    const out = html(doc(p({ type: "mention", attrs: { id: "00000000-0000-4000-8000-000000000001", label: "hakim" } })));
    expect(out).toContain('data-mention-id="00000000-0000-4000-8000-000000000001"');
    expect(out).toContain("@hakim");
  });

  it("renders lists, code blocks and hard breaks", () => {
    const out = html(
      doc(
        { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
        { type: "codeBlock", content: [t("x = 1")] },
        p(t("a"), { type: "hardBreak" }, t("b")),
      ),
    );
    expect(out).toContain("<ul");
    expect(out).toContain("<li><p");
    expect(out).toMatch(/<pre[^>]*><code>x = 1<\/code><\/pre>/);
    expect(out).toContain("a<br/>b");
  });

  it("does not crash on unknown nodes or empty input", () => {
    expect(html(doc({ type: "mystery", content: [t("kept")] }))).toContain("kept");
    expect(renderContent(null)).toBeNull();
  });
});

describe("sanitizeHref", () => {
  it("allows http, https and mailto only", () => {
    expect(sanitizeHref("http://a.b")).toBe("http://a.b/");
    expect(sanitizeHref("mailto:hi@potarastudio.com")).toBe("mailto:hi@potarastudio.com");
    expect(sanitizeHref("javascript:void(0)")).toBeNull();
    expect(sanitizeHref("data:text/html,x")).toBeNull();
    expect(sanitizeHref("not a url")).toBeNull();
    expect(sanitizeHref(42)).toBeNull();
  });
});

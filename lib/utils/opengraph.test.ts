import { describe, expect, it } from "vitest";
import { parseOpenGraph } from "./opengraph";

describe("parseOpenGraph", () => {
  it("prefers og tags, resolves relative images and decodes entities", () => {
    const html = `<html><head>
      <title>Fallback &amp; ignored</title>
      <meta property="og:title" content="Bluebird &#8212; Brand book" />
      <meta name="description" content="plain description">
      <meta property="og:description" content="The &quot;official&quot; guide"/>
      <meta property="og:image" content="/img/cover.png">
      <meta property="og:site_name" content="Bluebird">
    </head><body></body></html>`;
    expect(parseOpenGraph(html, "https://www.bluebird.example/brand")).toEqual({
      title: "Bluebird — Brand book",
      description: 'The "official" guide',
      image_url: "https://www.bluebird.example/img/cover.png",
      site_name: "Bluebird",
    });
  });

  it("falls back to <title>, meta description and the hostname", () => {
    const html = `<head><title>  Just a   page </title><meta name="description" content="hello"></head>`;
    expect(parseOpenGraph(html, "https://www.example.org/x")).toEqual({
      title: "Just a page",
      description: "hello",
      image_url: null,
      site_name: "example.org",
    });
  });

  it("handles attribute order and single quotes, and drops non-http images", () => {
    const html = `<meta content='T' property='og:title'><meta content="javascript:alert(1)" property="og:image">`;
    const og = parseOpenGraph(html, "https://a.b");
    expect(og.title).toBe("T");
    expect(og.image_url).toBeNull();
  });
});

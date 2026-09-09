/** Minimal OpenGraph / Twitter card / <title> parser. No DOM, no dependencies. */
export type OpenGraph = {
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      const key = e.toLowerCase();
      if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return ENTITIES[key] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(head: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(`<meta\\s+[^>]*${attr}\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = head.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
  return content ? decode(content) : null;
}

export function parseOpenGraph(html: string, baseUrl: string): OpenGraph {
  const head = html.slice(0, 200_000);
  const pick = (...keys: [attr: "property" | "name", key: string][]) => {
    for (const [attr, key] of keys) {
      const v = metaContent(head, attr, key);
      if (v) return v;
    }
    return null;
  };

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = pick(["property", "og:title"], ["name", "twitter:title"]) ?? (titleTag ? decode(titleTag) : null);
  const description = pick(["property", "og:description"], ["name", "twitter:description"], ["name", "description"]);
  const rawImage = pick(["property", "og:image:secure_url"], ["property", "og:image"], ["name", "twitter:image"]);
  const site_name = pick(["property", "og:site_name"]) ?? safeHost(baseUrl);

  let image_url: string | null = null;
  if (rawImage) {
    try {
      const u = new URL(rawImage, baseUrl);
      if (u.protocol === "https:" || u.protocol === "http:") image_url = u.toString();
    } catch {
      image_url = null;
    }
  }

  return {
    title: title ? title.slice(0, 200) : null,
    description: description ? description.slice(0, 400) : null,
    image_url,
    site_name: site_name ? site_name.slice(0, 80) : null,
  };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

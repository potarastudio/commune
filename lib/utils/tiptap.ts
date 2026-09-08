import type { JSONContent } from "@tiptap/core";

/**
 * Server-side helpers for the message insert path (§7).
 *
 * - toPlainText(): the `content_text` column. Mirrors public.tiptap_to_text().
 * - extractMentions(): rows for the `mentions` table. Mirrors public.extract_mentions().
 *
 * Mention nodes are `{ type: "mention", attrs: { id, label } }` where `id` is a
 * profile uuid, or the literal "channel" / "here".
 */

export type MentionKind = "user" | "channel" | "here";

export type ExtractedMention =
  | { kind: "user"; userId: string }
  | { kind: "channel" | "here"; userId: null };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Node types that end with a line break in the plain-text render. */
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "codeBlock",
  "blockquote",
  "listItem",
  "bulletList",
  "orderedList",
]);

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function toPlainText(node: JSONContent | null | undefined): string {
  if (!node || typeof node !== "object") return "";

  switch (node.type) {
    case "text":
      return node.text ?? "";
    case "hardBreak":
      return "\n";
    case "mention": {
      const label = node.attrs?.label ?? node.attrs?.id ?? "";
      return `@${label}`;
    }
    case "emoji": {
      const emoji = node.attrs?.emoji;
      if (typeof emoji === "string") return emoji;
      const name = node.attrs?.name;
      return typeof name === "string" ? `:${name}:` : "";
    }
  }

  let out = "";
  if (Array.isArray(node.content)) {
    for (const child of node.content) out += toPlainText(child);
  }
  if (node.type && BLOCK_TYPES.has(node.type)) out += "\n";
  return out;
}

/** content_text as stored: trimmed, so an empty composer yields "". */
export function toContentText(doc: JSONContent | null | undefined): string {
  return toPlainText(doc).trim();
}

export function extractMentions(node: JSONContent | null | undefined): ExtractedMention[] {
  const seen = new Set<string>();
  const out: ExtractedMention[] = [];

  const walk = (n: JSONContent | null | undefined) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "mention") {
      const rawId = n.attrs?.id;
      const id = typeof rawId === "string" ? rawId : undefined;
      if (id === "channel" || id === "here") {
        const key = `${id}:`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ kind: id, userId: null });
        }
      } else if (id && UUID_RE.test(id)) {
        const userId = id.toLowerCase();
        const key = `user:${userId}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ kind: "user", userId });
        }
      }
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };

  walk(node);
  return out;
}

/** True when the document has no text, mentions, emoji or embedded media. */
export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
  if (!doc) return true;
  if (toContentText(doc) !== "") return false;
  const hasNode = (n: JSONContent): boolean =>
    n.type === "image" || (Array.isArray(n.content) && n.content.some(hasNode));
  return !hasNode(doc);
}

/** Build a one-paragraph document from plain text (used by tests, seeds and system messages). */
export function docFromText(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}

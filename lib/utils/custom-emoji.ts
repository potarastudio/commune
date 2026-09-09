/** Custom emoji rules (§4 custom_emoji, §5 Phase 3). Pure; shared by upload UI, rendering and tests. */

export const EMOJI_NAME_RE = /^[a-z0-9_]{2,32}$/;
export const CUSTOM_EMOJI_MAX_BYTES = 256 * 1024;
export const CUSTOM_EMOJI_TYPES = ["image/png", "image/gif", "image/webp", "image/jpeg"] as const;

/** "Party Parrot.GIF" → "party_parrot". */
export function emojiNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

export function emojiNameProblem(name: string): string | null {
  if (!name) return "Give it a name.";
  if (!EMOJI_NAME_RE.test(name)) return "Use 2–32 lowercase letters, numbers or underscores.";
  return null;
}

/** ":name:" → "name", or null for anything else (unicode emoji, plain text). */
export function shortcodeName(value: string): string | null {
  const m = /^:([a-z0-9_]{2,32}):$/.exec(value);
  return m ? m[1] : null;
}

const SHORTCODE_RE = /:([a-z0-9_]{2,32}):/g;

/** Cheap pre-check so message text without any ":word:" skips the client-side splitter. */
export function mayContainShortcode(text: string): boolean {
  return /:[a-z0-9_]{2,32}:/.test(text);
}

export type TextSegment = { kind: "text"; value: string } | { kind: "emoji"; name: string; raw: string };

/** Split text into runs of plain text and known custom emoji. Unknown shortcodes stay as text. */
export function splitShortcodes(text: string, known: (name: string) => boolean): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(SHORTCODE_RE)) {
    const index = m.index ?? 0;
    if (!known(m[1])) continue;
    if (index > last) out.push({ kind: "text", value: text.slice(last, index) });
    out.push({ kind: "emoji", name: m[1], raw: m[0] });
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

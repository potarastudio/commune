"use client";

import { Fragment } from "react";
import { useCustomEmojiMap } from "@/lib/queries/custom-emoji-map";
import { shortcodeName, splitShortcodes } from "@/lib/utils/custom-emoji";

/**
 * Custom emoji ride the text they sit in. The design draws the glyph at the
 * size of its own context — 13px inside the 13px span of a reaction chip — and
 * a colour-emoji font paints roughly 1.15x its em box, so 1.15em lands an image
 * at the same optical size as the unicode glyph beside it (14.95px in the chip,
 * 16.1px in 14px message body) and still clears the chip's 28px height.
 * -0.2em drops the box onto the text baseline, matching an emoji glyph's
 * descent; `object-contain` keeps non-square uploads from stretching.
 */
const IMG_CLASS = "inline-block size-[1.15em] align-[-0.2em] object-contain select-none";

/** One emoji value as stored on a reaction: unicode, or ":name:" for a custom one. */
export function Emoji({ value, className = "" }: { value: string; className?: string }) {
  const map = useCustomEmojiMap();
  const name = shortcodeName(value);
  const src = name ? map.get(name) : undefined;
  if (!src) return <>{value}</>;
  // Tiny remote images; next/image adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={value} title={value} className={`${IMG_CLASS} ${className}`} draggable={false} decoding="async" />;
}

/** Message text with any known ":name:" swapped for its image. Unknown shortcodes stay as typed. */
export function EmojiText({ text }: { text: string }) {
  const map = useCustomEmojiMap();
  if (map.size === 0) return <>{text}</>;
  const parts = splitShortcodes(text, (n) => map.has(n));
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Fragment key={i}>{p.value}</Fragment>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={map.get(p.name)} alt={p.raw} title={p.raw} className={IMG_CLASS} draggable={false} decoding="async" />
        ),
      )}
    </>
  );
}

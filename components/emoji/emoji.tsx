"use client";

import { Fragment } from "react";
import { useCustomEmojiMap } from "@/lib/queries/custom-emoji-map";
import { shortcodeName, splitShortcodes } from "@/lib/utils/custom-emoji";

const IMG_CLASS = "inline-block size-[1.25em] align-[-0.3em] object-contain";

/** One emoji value as stored on a reaction: unicode, or ":name:" for a custom one. */
export function Emoji({ value, className = "" }: { value: string; className?: string }) {
  const map = useCustomEmojiMap();
  const name = shortcodeName(value);
  const src = name ? map.get(name) : undefined;
  if (!src) return <>{value}</>;
  // Tiny remote images; next/image adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={value} title={value} className={`${IMG_CLASS} ${className}`} draggable={false} />;
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
          <img key={i} src={map.get(p.name)} alt={p.raw} title={p.raw} className={IMG_CLASS} draggable={false} />
        ),
      )}
    </>
  );
}

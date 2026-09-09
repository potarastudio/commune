"use client";

import { forwardRef } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { EmojiItem } from "@/lib/composer/emoji";
import { SuggestionList, type SuggestionListRef } from "./suggestion-list";

export const EmojiList = forwardRef<SuggestionListRef, SuggestionProps<EmojiItem>>(function EmojiList(props, ref) {
  return (
    <SuggestionList<EmojiItem>
      ref={ref}
      items={props.items}
      command={(item) => props.command(item)}
      label="Emoji"
      emptyLabel="No emoji match."
      heading={props.query ? `Emoji matching “:${props.query}”` : "Emoji"}
      widthClass="w-[332px]"
      renderItem={(item) => (
        <>
          <span className="grid size-[21px] shrink-0 place-items-center text-[17px] leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.src ? <img src={item.src} alt="" className="size-[17px] object-contain" /> : item.native}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono text-[12.5px] font-medium text-ink">:{item.id}:</span>
            <span className="ml-2 text-[12px] text-muted-foreground">{item.name}</span>
          </span>
        </>
      )}
    />
  );
});

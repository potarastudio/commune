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
      renderItem={(item) => (
        <>
          <span className="grid w-6 place-items-center text-[18px] leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.src ? <img src={item.src} alt="" className="size-5 object-contain" /> : item.native}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono text-[12.5px]">:{item.id}:</span>
            <span className="ml-1.5 text-muted-foreground">{item.name}</span>
          </span>
        </>
      )}
    />
  );
});

"use client";

import { AtSign, Hash } from "lucide-react";
import { forwardRef } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { AvatarPresence } from "@/components/presence/online-dot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MentionItem } from "@/lib/composer/mentions";
import { Kbd, SuggestionList, type SuggestionListRef } from "./suggestion-list";

export const MentionList = forwardRef<SuggestionListRef, SuggestionProps<MentionItem>>(function MentionList(props, ref) {
  return (
    <SuggestionList<MentionItem>
      ref={ref}
      items={props.items}
      command={(item) => props.command(item)}
      label="Mention someone"
      emptyLabel="Nobody matches."
      heading={props.query ? `People matching “${props.query}”` : "People"}
      widthClass="w-[340px]"
      renderItem={(item, selected) => (
        <>
          {item.special ? (
            <span className="grid size-[26px] shrink-0 place-items-center rounded-md border border-accent-surface-border bg-accent-surface text-accent-foreground">
              {item.id === "channel" ? <Hash className="size-[13px]" aria-hidden="true" /> : <AtSign className="size-[13px]" aria-hidden="true" />}
            </span>
          ) : (
            // The design rings each person's 26px avatar with a presence dot.
            <span className="relative block size-[26px] shrink-0">
              <Avatar className="size-[26px] rounded-full bg-bg-avatar">
                <AvatarImage src={item.avatar_url ?? undefined} alt="" className="object-cover" />
                <AvatarFallback className="rounded-full bg-bg-avatar text-[10px] font-semibold text-fg-500">
                  {item.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <AvatarPresence userId={item.id} ring="border-bg-card" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{item.special ? `@${item.label}` : item.name}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{item.special ? item.name : `@${item.label}`}</span>
          </span>
          {selected && <Kbd className="shrink-0">↵</Kbd>}
        </>
      )}
    />
  );
});

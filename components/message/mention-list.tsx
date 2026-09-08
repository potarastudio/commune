"use client";

import { AtSign, Hash } from "lucide-react";
import { forwardRef } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MentionItem } from "@/lib/composer/mentions";
import { SuggestionList, type SuggestionListRef } from "./suggestion-list";

export const MentionList = forwardRef<SuggestionListRef, SuggestionProps<MentionItem>>(function MentionList(props, ref) {
  return (
    <SuggestionList<MentionItem>
      ref={ref}
      items={props.items}
      command={(item) => props.command(item)}
      label="Mention someone"
      emptyLabel="Nobody matches."
      renderItem={(item) => (
        <>
          {item.special ? (
            <span className="grid size-6 shrink-0 place-items-center rounded bg-mention text-mention-foreground">
              {item.id === "channel" ? <Hash className="size-3.5" aria-hidden="true" /> : <AtSign className="size-3.5" aria-hidden="true" />}
            </span>
          ) : (
            <Avatar className="size-6 rounded">
              <AvatarImage src={item.avatar_url ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="rounded bg-accent text-[10px] font-semibold text-accent-foreground">
                {item.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{item.special ? `@${item.label}` : item.name}</span>
            <span className="ml-1.5 text-muted-foreground">{item.special ? item.name : `@${item.label}`}</span>
          </span>
        </>
      )}
    />
  );
});

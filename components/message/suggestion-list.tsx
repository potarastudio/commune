"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

export type SuggestionListRef = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

type Props<T> = {
  items: T[];
  command: (item: T) => void;
  renderItem: (item: T, selected: boolean) => React.ReactNode;
  emptyLabel: string;
  label: string;
};

/** Keyboard-navigable popup used by @mention and :emoji: autocomplete. */
function SuggestionListInner<T>({ items, command, renderItem, emptyLabel, label }: Props<T>, ref: React.Ref<SuggestionListRef>) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setIndex((i) => (i + items.length - 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (items[index]) {
          command(items[index]);
          return true;
        }
        return false;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label={label}
      className="max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {items.length === 0 && <div className="px-2 py-2 text-[13px] text-muted-foreground">{emptyLabel}</div>}
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="option"
          aria-selected={i === index}
          onMouseEnter={() => setIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
            i === index ? "bg-accent text-accent-foreground" : ""
          }`}
        >
          {renderItem(item, i === index)}
        </button>
      ))}
    </div>
  );
}

export const SuggestionList = forwardRef(SuggestionListInner) as <T>(
  props: Props<T> & { ref?: React.Ref<SuggestionListRef> },
) => React.ReactElement;

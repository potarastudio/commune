"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

export type SuggestionListRef = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

/** The design's keycap: 4px radius, strong border, subtle fill, 11px medium. */
export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex items-center rounded-[4px] border border-border-strong bg-bg-subtle px-[5px] py-px font-sans text-[11px] font-medium text-fg-600 ${className}`}
    >
      {children}
    </kbd>
  );
}

type Props<T> = {
  items: T[];
  command: (item: T) => void;
  renderItem: (item: T, selected: boolean) => React.ReactNode;
  emptyLabel: string;
  label: string;
  /** Caps overline above the rows — the design shows what the query matched. */
  heading: string;
  /** Width utility — w-[340px] for mentions, w-[332px] for emoji (design). */
  widthClass: string;
};

/** Keyboard-navigable popup used by @mention and :emoji: autocomplete. */
function SuggestionListInner<T>(
  { items, command, renderItem, emptyLabel, label, heading, widthClass }: Props<T>,
  ref: React.Ref<SuggestionListRef>,
) {
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
      className={`${widthClass} max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border bg-bg-card text-ink shadow-lg`}
    >
      <p className="border-b border-border-subtle px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {heading}
      </p>
      <div className="max-h-72 overflow-y-auto">
        {items.length === 0 && <div className="px-3 py-2.5 text-[13px] text-muted-foreground">{emptyLabel}</div>}
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            role="option"
            aria-selected={i === index}
            onMouseEnter={() => setIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(item)}
            // The design highlights the active row with bg-subtle, not the accent
            // surface — rows can contain accent-tinted children (@channel / @here)
            // that would otherwise dissolve into the highlight.
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              i === index ? "bg-bg-subtle" : "hover:bg-bg-subtle"
            }`}
          >
            {renderItem(item, i === index)}
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-[7px] text-[11.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </span>
          to move ·<Kbd>esc</Kbd> to dismiss
        </div>
      )}
    </div>
  );
}

export const SuggestionList = forwardRef(SuggestionListInner) as <T>(
  props: Props<T> & { ref?: React.Ref<SuggestionListRef> },
) => React.ReactElement;

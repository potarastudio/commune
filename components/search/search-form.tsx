"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The operator hints. The design keeps this teaching out of the results page —
 * the facet bar owns that row — and puts suggestion chips in the empty state
 * instead, so they only appear when there is nothing else to read.
 * `stem` is what a click drops into the field; the label shows the shape.
 */
const TIPS = [
  { stem: "from:@", placeholder: "handle", hint: "messages by a person" },
  { stem: "in:#", placeholder: "channel", hint: "inside one channel" },
  { stem: "after:", placeholder: "YYYY-MM-DD", hint: "newer than a date" },
  { stem: "before:", placeholder: "YYYY-MM-DD", hint: "older than a date" },
] as const;

/**
 * There is exactly one search field on this view, and the chips that feed it
 * live in the empty state at the other end of the page. A module-level handle,
 * registered by the mounted field, keeps them connected without pushing the
 * query through the URL (an operator with no value is not a search yet).
 */
let applyOperator: ((stem: string) => void) | null = null;

/**
 * The search box on /search. Submitting updates ?q= so results are
 * server-rendered and linkable. The design puts it in the 56px view header:
 * a 36px field capped at 520px, r10 on --border-input, with the 3px accent
 * halo (.field-focus) while it holds focus.
 */
export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialQuery);
  const [seenQuery, setSeenQuery] = useState(initialQuery);

  // The route never unmounts this form, so a navigation that changes ?q= —
  // back/forward, or a link from elsewhere — has to be pulled into the field.
  if (seenQuery !== initialQuery) {
    setSeenQuery(initialQuery);
    setValue(initialQuery);
  }

  useEffect(() => {
    applyOperator = (stem) => {
      setValue((current) => {
        const base = current.trimEnd();
        return base ? `${base} ${stem}` : stem;
      });
      const el = inputRef.current;
      if (el) {
        el.focus();
        // Caret to the end, so the next keystroke completes the operator.
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }
    };
    return () => {
      applyOperator = null;
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      className="field-focus flex h-9 min-w-0 max-w-[520px] flex-1 items-center gap-[9px] rounded-[10px] border border-border-input bg-bg-card px-[11px] transition-colors"
    >
      <Search className="size-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search messages"
        aria-label="Search messages"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-body outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            router.push("/search");
          }}
          className="grid size-[22px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-subtle hover:text-ink"
        >
          <X className="size-[13px]" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

/**
 * The empty state's suggestion chips, drawn like the design's no-results tile:
 * 28px, r7 on --border-strong over --bg-card, 12/500 in --fg-400 behind a 12px
 * search glyph. Pressing one appends the operator to the field and puts the
 * caret after it, so these are real controls rather than button-shaped labels.
 */
export function SearchTips() {
  return (
    <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
      {TIPS.map((tip) => (
        <button
          key={tip.stem}
          type="button"
          title={tip.hint}
          aria-label={`Add ${tip.stem} to the search — ${tip.hint}`}
          onClick={() => applyOperator?.(tip.stem)}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-bg-card px-2.5 font-mono text-[12px] font-medium text-fg-400 transition-colors hover:border-border-hover hover:bg-bg-card-hover"
        >
          <Search className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            {tip.stem}
            <span className="text-muted-foreground">{tip.placeholder}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

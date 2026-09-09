"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The search box on /search. Submitting updates ?q= so results are
 * server-rendered and linkable. The design puts it in the 56px view header:
 * a 36px field capped at 520px, r10 on --border-input, with the 3px accent
 * halo (.field-focus) while it holds focus.
 */
export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

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

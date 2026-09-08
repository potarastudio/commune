"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The search box on /search. Submitting updates ?q= so results are server-rendered and linkable. */
export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <form onSubmit={submit} role="search" className="relative">
      <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search messages"
        aria-label="Search messages"
        className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-[15px] shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            router.push("/search");
          }}
          className="absolute inset-y-0 right-2 my-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

"use client";

import { Check, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePresenceStore } from "@/lib/store/presence";
import { startConversationAction } from "@/lib/actions/conversations";
import type { Profile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";
import { useMobileNav } from "./use-mobile-nav";
import { RoundFace } from "./ui";

const MAX_OTHERS = 7; // 8 people including you (§5)

/**
 * New message on the phone: a full-screen surface that closes rather than
 * pops. Cancel on the left, the one action on the right, the people you pick
 * as chips in the To line, everyone else below at a thumb's height.
 */
export function NewMessageScreen({ people, meId }: { people: Profile[]; meId: string }) {
  const nav = useMobileNav();
  const online = usePresenceStore((s) => s.online);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Profile[]>([]);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return people.filter((p) => p.id !== meId && (q === "" || p.display_name.toLowerCase().includes(q) || p.handle.includes(q)));
  }, [people, query, meId]);

  const toggle = (p: Profile) =>
    setPicked((cur) => {
      if (cur.some((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id);
      if (cur.length >= MAX_OTHERS) {
        toast.error("Group messages are limited to 8 people");
        return cur;
      }
      return [...cur, p];
    });

  const start = () =>
    startTransition(async () => {
      const result = await startConversationAction({ userIds: picked.map((p) => p.id) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      nav.replaceSurface(`/dm/${result.id}`);
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-main">
      <header className="flex h-[52px] shrink-0 items-center gap-[4px] border-b border-border px-[6px]">
        <button type="button" onClick={nav.closeSurface} className="flex h-[44px] shrink-0 items-center px-[10px] text-[14px] font-semibold text-fg-600">
          Cancel
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold tracking-[-0.015em] text-ink">New message</h1>
        <button
          type="button"
          onClick={start}
          disabled={picked.length === 0 || pending}
          className="flex h-[44px] shrink-0 items-center px-[10px] text-[14px] font-semibold text-accent-text disabled:text-muted-foreground"
        >
          {pending ? "Opening…" : picked.length > 1 ? "Start group" : "Start"}
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-[6px] border-b border-border px-[16px] py-[8px]">
        <span className="text-[14px] text-muted-foreground">To:</span>
        {picked.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p)}
            aria-label={`Remove ${p.display_name}`}
            className="flex h-[32px] items-center gap-[6px] rounded-[9px] border border-accent-surface-border bg-accent-surface pr-[6px] pl-[3px] text-[13.5px] font-semibold text-accent-foreground"
          >
            <RoundFace person={p} size={24} />
            {p.display_name.split(" ")[0]}
            <X className="size-[13px]" aria-hidden="true" />
          </button>
        ))}
        <span className="flex min-w-[140px] flex-1 items-center gap-[8px]">
          {picked.length === 0 && <Search className="size-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && query === "" && picked.length) setPicked((c) => c.slice(0, -1));
            }}
            enterKeyHint="done"
            placeholder={picked.length ? "Add someone else" : "Name or @handle"}
            aria-label="Search people"
            className="h-[36px] min-w-0 flex-1 bg-transparent text-[15px] text-body outline-none placeholder:text-muted-foreground"
          />
        </span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(16px+var(--safe-bottom))]" role="listbox" aria-label="People" aria-multiselectable="true">
        {results.length === 0 && (
          <li className="px-[24px] pt-[40px] text-center">
            <p className="text-[15px] font-semibold text-ink">No one matches &ldquo;{query}&rdquo;</p>
            <p className="mx-auto mt-[6px] max-w-[280px] text-[13.5px] leading-[1.55] text-fg-600">Try their first name, or the @handle they use in messages.</p>
          </li>
        )}
        {results.map((p) => {
          const selected = picked.some((x) => x.id === p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  toggle(p);
                  setQuery("");
                }}
                className={cn("flex min-h-[60px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left active:bg-bg-hover", selected && "bg-bg-subtle")}
              >
                <span className="relative block size-[40px] shrink-0">
                  <RoundFace person={p} size={40} />
                  {online.has(p.id) && <span aria-hidden="true" className="absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-bg-main bg-presence" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{p.display_name}</span>
                  <span className="mt-px block truncate text-[12.5px] text-muted-foreground">
                    @{p.handle}
                    {p.title ? ` · ${p.title}` : ""}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px]",
                    selected ? "border-accent-border bg-primary text-white" : "border-border-input text-transparent",
                  )}
                >
                  <Check className="size-[13px]" strokeWidth={2.5} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

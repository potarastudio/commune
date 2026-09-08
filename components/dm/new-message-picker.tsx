"use client";

import { Check, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/actions/conversations";
import type { Profile } from "@/lib/queries/profile";

const MAX_OTHERS = 7; // 8 people including you (§5)

export function NewMessagePicker({ people, meId }: { people: Profile[]; meId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Profile[]>([]);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (p) => p.id !== meId && (q === "" || p.display_name.toLowerCase().includes(q) || p.handle.includes(q)),
    );
  }, [people, query, meId]);

  const toggle = (p: Profile) => {
    setPicked((cur) => {
      if (cur.some((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id);
      if (cur.length >= MAX_OTHERS) {
        toast.error("Group messages are limited to 8 people.");
        return cur;
      }
      return [...cur, p];
    });
  };

  const start = () => {
    startTransition(async () => {
      const result = await startConversationAction({ userIds: picked.map((p) => p.id) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/dm/${result.id}`);
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-8">
      <h2 className="text-[20px] font-semibold tracking-tight">New message</h2>
      <p className="mt-1 text-muted-foreground">Pick one person for a direct message, or up to seven for a group.</p>

      <div className="mt-6 flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
        {picked.map((p) => (
          <span key={p.id} className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[13px] text-accent-foreground">
            {p.display_name}
            <button type="button" aria-label={`Remove ${p.display_name}`} onClick={() => toggle(p)} className="rounded hover:bg-black/10">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <span className="flex flex-1 items-center gap-2">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && query === "" && picked.length) setPicked((c) => c.slice(0, -1));
              if (e.key === "Enter" && results.length === 1) {
                e.preventDefault();
                toggle(results[0]);
                setQuery("");
              }
            }}
            placeholder={picked.length ? "Add someone else" : "Search by name or @handle"}
            aria-label="Search people"
            className="h-7 min-w-32 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </span>
      </div>

      <ul className="mt-3 divide-y divide-border rounded-lg border border-border" role="listbox" aria-label="People" aria-multiselectable="true">
        {results.length === 0 && (
          <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nobody matches &ldquo;{query}&rdquo;.</li>
        )}
        {results.map((p) => {
          const selected = picked.some((x) => x.id === p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(p)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
              >
                <Avatar className="size-8 rounded-md">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="rounded-md bg-accent text-[12px] font-semibold text-accent-foreground">
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14px] font-medium">{p.display_name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    @{p.handle}
                    {p.title ? ` · ${p.title}` : ""}
                  </span>
                </span>
                <span
                  className={`grid size-5 place-items-center rounded-full border ${
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check className="size-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center gap-3">
        <Button type="button" size="lg" className="h-10 px-5" disabled={picked.length === 0 || pending} onClick={start}>
          {pending ? "Opening…" : picked.length > 1 ? `Start group with ${picked.length} people` : "Start conversation"}
        </Button>
        <span className="text-[12px] text-muted-foreground">Existing conversations with the same people are reused.</span>
      </div>
    </div>
  );
}

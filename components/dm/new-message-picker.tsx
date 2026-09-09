"use client";

import { Check, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AvatarPresence } from "@/components/presence/online-dot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/actions/conversations";
import type { Profile } from "@/lib/queries/profile";

const MAX_OTHERS = 7; // 8 people including you (§5)

/**
 * Person avatar. The shared primitive already carries the round shape,
 * --bg-avatar and the inset --avatar-ring hairline, so this only picks a size
 * off the handoff scale.
 */
function PersonAvatar({ person, size }: { person: Profile; size?: "xs" }) {
  return (
    <Avatar size={size}>
      <AvatarImage src={person.avatar_url ?? undefined} alt="" />
      <AvatarFallback>{person.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

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
    <div className="mx-auto w-full max-w-[560px] px-6 py-8">
      <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">New message</h2>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-fg-600">
        Pick one person for a direct message, or up to seven for a group.
      </p>

      <div className="mt-6">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-fg-400">People</span>
        <div className="field-focus flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-border-input bg-bg-card px-2 py-1.5 shadow-xs">
          {picked.map((p) => (
            <span
              key={p.id}
              className="flex h-[26px] items-center gap-1.5 rounded-md border border-accent-surface-border bg-accent-surface pr-1 pl-0.5 text-[12.5px] font-medium text-accent-foreground"
            >
              <PersonAvatar person={p} size="xs" />
              {p.display_name}
              <button
                type="button"
                aria-label={`Remove ${p.display_name}`}
                onClick={() => toggle(p)}
                className="grid size-[18px] place-items-center rounded-sm hover:bg-accent-surface-border"
              >
                <X className="size-[11px]" aria-hidden="true" />
              </button>
            </span>
          ))}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Search className="size-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
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
              className="h-[26px] min-w-32 flex-1 bg-transparent text-[14px] text-body outline-none placeholder:text-muted-foreground"
            />
          </span>
        </div>
        <p className="mt-1.5 text-[12px] leading-[1.45] text-muted-foreground">
          Names or @handles. A group holds eight people, you included.
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-px" role="listbox" aria-label="People" aria-multiselectable="true">
        {results.length === 0 && (
          <li className="px-3 py-7 text-center">
            <p className="text-[14px] font-semibold text-ink">No matches for &ldquo;{query}&rdquo;</p>
            <p className="mx-auto mt-1.5 max-w-[300px] text-[12.5px] leading-[1.55] text-fg-600">
              Try their first name, or the @handle they use in messages.
            </p>
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
                onClick={() => toggle(p)}
                className={`flex w-full items-center gap-[11px] rounded-md px-2.5 py-[9px] text-left hover:bg-bg-hover ${
                  selected ? "bg-bg-subtle" : ""
                }`}
              >
                <span className="relative block size-8 shrink-0">
                  <PersonAvatar person={p} />
                  <AvatarPresence userId={p.id} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{p.display_name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    @{p.handle}
                    {p.title ? ` · ${p.title}` : ""}
                  </span>
                </span>
                {/* The design set draws exactly one checkbox: 16px, 4px radius. */}
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-[4px] border ${
                    selected
                      ? "border-accent-border bg-primary text-primary-foreground"
                      : "border-border-input text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="size-[11px]" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center gap-2.5">
        <Button
          type="button"
          className="h-[34px] rounded-md border border-accent-border px-[13px] text-[13px] font-semibold shadow-sm"
          disabled={picked.length === 0 || pending}
          onClick={start}
        >
          {pending ? "Opening…" : picked.length > 1 ? `Start group with ${picked.length} people` : "Start conversation"}
        </Button>
        <span className="text-[12px] text-muted-foreground">Existing conversations with the same people are reused.</span>
      </div>
    </div>
  );
}

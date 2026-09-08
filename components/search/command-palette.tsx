"use client";

import { Hash, Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { startConversationAction } from "@/lib/actions/conversations";
import { useBrowseableChannels } from "@/lib/queries/channels-client";
import { useProfiles } from "@/lib/queries/profiles";
import { useUiStore } from "@/lib/store/ui";

/**
 * Cmd/Ctrl+K quick switcher (§5): channels and people, plus a jump to
 * message search for whatever was typed.
 */
export function CommandPalette({ meId, joinedChannelIds }: { meId: string; joinedChannelIds: string[] }) {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const { data: channels } = useBrowseableChannels(open);
  const { data: people } = useProfiles();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const openDm = (userId: string) => {
    startTransition(async () => {
      const result = await startConversationAction({ userIds: [userId] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      go(`/dm/${result.id}`);
    });
  };

  const joined = new Set(joinedChannelIds);
  const trimmed = query.trim();

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Quick switcher" description="Jump to a channel or person, or search messages.">
      <CommandInput placeholder="Jump to a channel or person…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nothing matches. Press Enter to search messages instead.</CommandEmpty>

        {trimmed && (
          <>
            <CommandGroup heading="Messages">
              <CommandItem value={`search ${trimmed}`} onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}>
                <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>
                  Search messages for <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Channels">
          {(channels ?? []).map((c) => (
            <CommandItem key={c.id} value={`channel ${c.name} ${c.topic ?? ""}`} onSelect={() => go(`/channel/${c.id}`)}>
              {c.is_private ? (
                <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Hash className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {c.name}
                {c.topic && <span className="ml-2 text-muted-foreground">{c.topic}</span>}
              </span>
              {!joined.has(c.id) && <span className="text-[11px] text-muted-foreground">Not joined</span>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="People">
          {(people ?? [])
            .filter((p) => p.id !== meId)
            .map((p) => (
              <CommandItem key={p.id} value={`person ${p.display_name} ${p.handle}`} onSelect={() => openDm(p.id)} disabled={pending}>
                <Avatar className="size-5 rounded">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="rounded bg-accent text-[9px] font-semibold text-accent-foreground">
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  {p.display_name}
                  <span className="ml-2 text-muted-foreground">@{p.handle}</span>
                </span>
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          <kbd className="rounded border border-border px-1 font-sans">↑↓</kbd> to move
        </span>
        <span>
          <kbd className="rounded border border-border px-1 font-sans">Enter</kbd> to open
        </span>
        <span>
          <kbd className="rounded border border-border px-1 font-sans">Esc</kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}

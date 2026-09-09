"use client";

import { useCommandState } from "cmdk";
import { Compass, Hash, Lock, MessageSquareText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { startConversationAction } from "@/lib/actions/conversations";
import { useBrowseableChannels } from "@/lib/queries/channels-client";
import { useProfiles } from "@/lib/queries/profiles";
import { useUiStore } from "@/lib/store/ui";

/** The keycap chip used in the query row and the footer hint. */
const KBD =
  "inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-sm border border-border-strong bg-bg-subtle px-[5px] font-sans text-[11px] font-semibold text-fg-400";

/** 28px suggestion chip in the no-results tile. */
const CHIP =
  "flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-bg-card px-2.5 text-[12px] font-medium text-fg-400 transition-colors hover:border-border-hover hover:bg-bg-card-hover";

/**
 * cmdk's root owns Enter for its whole subtree — it preventDefaults every one,
 * which would cancel a focused chip's own activation. Keeping Enter away from
 * the root leaves the button's default behaviour intact (§6: every interactive
 * element has a keyboard path).
 */
function stopEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") e.stopPropagation();
}

/** The 24px chip that stands in for a channel, a message or a file. */
function Tile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-md border border-border-subtle bg-bg-chip text-fg-600">
      {children}
    </span>
  );
}

/**
 * Renders its children only while the query matched something. Force-mounted
 * rows are excluded from `filtered.count`, so this is what keeps the "Messages"
 * group out of the no-results state — the design goes straight from the tile to
 * the footer there.
 */
function WhenMatches({ children }: { children: React.ReactNode }) {
  const matches = useCommandState((state) => state.filtered.count);
  return matches > 0 ? <>{children}</> : null;
}

/**
 * The query row. Enter normally opens the selected row; with nothing matched
 * there is no selected row, so it falls through to full message search — the
 * behaviour the force-mounted "Search messages" item used to provide.
 */
function QueryRow({ value, onValueChange, onFallback }: { value: string; onValueChange: (v: string) => void; onFallback: (() => void) | null }) {
  const matches = useCommandState((state) => state.filtered.count);
  return (
    <div
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key !== "Enter" || matches > 0 || !onFallback) return;
        // cmdk skips a keydown that is already defaultPrevented.
        e.preventDefault();
        onFallback();
      }}
    >
      <CommandInput
        placeholder="Jump to a channel or person…"
        value={value}
        onValueChange={onValueChange}
        className="pr-[34px]"
      />
      <kbd aria-hidden="true" className={`${KBD} pointer-events-none absolute top-1/2 right-4 -translate-y-1/2`}>
        esc
      </kbd>
    </div>
  );
}

/**
 * The design's no-results tile: 26/22/24 padding, a 14/600 title, a 12.5/1.55
 * sub-line capped at 300px, and a row of 28px chips. It sits between the query
 * row and the footer — outside CommandList, so its buttons are not children of
 * the list's role="listbox". The -mt-2 cancels the empty list's own 8px bottom
 * padding, which would otherwise show as a gap above the tile.
 */
function NoMatches({
  query,
  fewerWords,
  onUseFewerWords,
  onSearchAll,
  onBrowseChannels,
}: {
  query: string;
  fewerWords: string | null;
  onUseFewerWords: (q: string) => void;
  onSearchAll: () => void;
  onBrowseChannels: () => void;
}) {
  const matches = useCommandState((state) => state.filtered.count);
  if (!query || matches > 0) return null;
  return (
    <div className="-mt-2 shrink-0 px-[22px] pt-[26px] pb-[24px] text-center">
      <p className="text-[14px] font-semibold text-ink">No matches for &ldquo;{query}&rdquo;</p>
      <p className="mx-auto mt-1.5 max-w-[300px] text-[12.5px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
        Try fewer words, or search one channel.
      </p>
      <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
        {fewerWords && (
          <button type="button" onClick={() => onUseFewerWords(fewerWords)} onKeyDown={stopEnter} className={CHIP}>
            <Search className="size-3 text-muted-foreground" aria-hidden="true" />
            {fewerWords}
          </button>
        )}
        <button type="button" onClick={onSearchAll} onKeyDown={stopEnter} className={CHIP}>
          <Search className="size-3 text-muted-foreground" aria-hidden="true" />
          Search all messages
        </button>
        <button type="button" onClick={onBrowseChannels} onKeyDown={stopEnter} className={CHIP}>
          <Compass className="size-3 text-muted-foreground" aria-hidden="true" />
          Browse channels
        </button>
      </div>
    </div>
  );
}

/**
 * Cmd/Ctrl+K quick switcher (§5): channels and people, plus a jump to message
 * search for whatever was typed. The design's canonical palette — 520px, r14
 * on --bg-card, a 17px query row, full-bleed rows selected with --bg-subtle,
 * and a footer of keycap hints. Row and heading styling lives in
 * components/ui/command.tsx; this file supplies the content and the chrome
 * around it.
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
  const words = trimmed.split(/\s+/).filter(Boolean);
  const fewerWords = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  const searchAll = () => go(`/search?q=${encodeURIComponent(trimmed)}`);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick switcher"
      description="Jump to a channel or person, or search messages."
      showCloseButton={false}
      className="rounded-[14px] border-border"
    >
      {/* The design hangs an `esc` keycap off the right of the query row. */}
      <QueryRow value={query} onValueChange={setQuery} onFallback={trimmed ? searchAll : null} />

      <CommandList>
        <CommandGroup heading="Channels">
          <CommandItem value="browse channels" onSelect={() => go("/channels")}>
            <Tile>
              <Compass className="size-[13px]" aria-hidden="true" />
            </Tile>
            <span className="min-w-0 flex-1 truncate">Browse channels</span>
            <CommandShortcut>All channels</CommandShortcut>
          </CommandItem>
          {(channels ?? []).map((c) => (
            <CommandItem
              key={c.id}
              value={`channel ${c.name} ${c.topic ?? ""}`}
              onSelect={() => go(`/channel/${c.id}`)}
            >
              <Tile>
                {c.is_private ? (
                  <Lock className="size-[13px]" aria-hidden="true" />
                ) : (
                  <Hash className="size-[13px]" aria-hidden="true" />
                )}
              </Tile>
              {/* The design's channel row is the name alone; the topic stays in
                  the match value so typing it still finds the channel. */}
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <CommandShortcut>{joined.has(c.id) ? "Jump to" : "Not joined"}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="People">
          {(people ?? [])
            .filter((p) => p.id !== meId)
            .map((p) => (
              <CommandItem
                key={p.id}
                value={`person ${p.display_name} ${p.handle}`}
                onSelect={() => openDm(p.id)}
                disabled={pending}
              >
                <Avatar className="size-6 shrink-0 bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="bg-bg-avatar text-[10px] font-semibold text-fg-600">
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  {p.display_name} · @{p.handle}
                </span>
                <CommandShortcut>Message</CommandShortcut>
              </CommandItem>
            ))}
        </CommandGroup>

        {/* Force-mounted so a query that matched something always offers full
            search too; WhenMatches keeps it out of the no-results state, where
            the design shows the tile alone. */}
        {trimmed && (
          <WhenMatches>
            <CommandGroup heading="Messages" forceMount>
              <CommandItem forceMount value="__search_messages__" onSelect={searchAll}>
                <Tile>
                  <MessageSquareText className="size-[13px]" aria-hidden="true" />
                </Tile>
                <span className="min-w-0 flex-1 truncate">
                  Search messages for <span className="font-semibold">&ldquo;{trimmed}&rdquo;</span>
                </span>
                <CommandShortcut>Full search</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </WhenMatches>
        )}
      </CommandList>

      <NoMatches
        query={trimmed}
        fewerWords={fewerWords}
        onUseFewerWords={setQuery}
        onSearchAll={searchAll}
        onBrowseChannels={() => go("/channels")}
      />

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border-subtle bg-bg-col px-[14px] py-[9px] text-[11.5px] text-muted-foreground">
        <kbd className={KBD}>↑</kbd>
        <kbd className={KBD}>↓</kbd>
        <span>to move ·</span>
        <kbd className={KBD}>↵</kbd>
        <span>to open ·</span>
        <kbd className={KBD}>⌘K</kbd>
        <span>to close</span>
      </div>
    </CommandDialog>
  );
}

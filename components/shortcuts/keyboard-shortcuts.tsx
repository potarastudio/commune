"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { markReadAction } from "@/lib/actions/messages";
import type { Container } from "@/lib/queries/messages";
import { clearUnread, unreadKeys, type UnreadMap } from "@/lib/queries/unreads";
import { useUiStore } from "@/lib/store/ui";
import { inEditableTarget, isMac, nextItem, type NavItem } from "@/lib/utils/shortcuts";

/** Fired on Esc / Shift+Esc; the open message pane hides its "New messages" line and marks itself read. */
export const MARK_READ_EVENT = "commune:mark-read";

function containerFromKey(key: string): Container | null {
  const [kind, id] = key.split(":");
  return kind === "channel" || kind === "conversation" ? { kind, id } : null;
}

/**
 * The design's Messages group: one letter per hover-toolbar action, fired on the
 * row the pointer is over. Each entry names the button by its `aria-label`, so the
 * key runs the row's own handler — optimistic update, toast and all — rather than a
 * second copy of it. Saving toggles, hence the two labels for `s`.
 */
const MESSAGE_ACTIONS: Record<string, readonly string[]> = {
  t: ["Reply in thread"],
  r: ["Add reaction"],
  e: ["Edit message"],
  s: ["Save for later", "Remove from saved"],
};

/** The message the pointer is over, else the one holding focus — i.e. whichever row is showing its toolbar. */
function hoveredMessage(): HTMLElement | null {
  const under = document.querySelectorAll<HTMLElement>("article[id^='message-']:hover");
  const deepest = under[under.length - 1];
  if (deepest) return deepest;
  const active = document.activeElement;
  return active instanceof HTMLElement ? active.closest<HTMLElement>("article[id^='message-']") : null;
}

/**
 * Global keys (§5 Phase 3): Cmd+/ or ? for the overlay, Alt+↑/↓ to move through
 * the sidebar, Alt+Shift+↑/↓ through unreads, Esc to mark the open channel read,
 * Shift+Esc to mark everything read, and T/R/E/S on the hovered message. Composer
 * and dialogs keep their own keys.
 */
export function KeyboardShortcuts({ items }: { items: NavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);

  const markAllRead = useCallback(async () => {
    const unreads = queryClient.getQueryData<UnreadMap>(unreadKeys.all) ?? {};
    const targets = items.filter((i) => (unreads[i.key]?.unread ?? 0) > 0).map((i) => containerFromKey(i.key)).filter((c): c is Container => c !== null);
    window.dispatchEvent(new CustomEvent(MARK_READ_EVENT));
    if (targets.length === 0) return;
    for (const c of targets) clearUnread(queryClient, c);
    const results = await Promise.all(targets.map((container) => markReadAction({ container })));
    if (results.some((r) => !r.ok)) {
      toast.error("Couldn't mark everything as read");
      void queryClient.invalidateQueries({ queryKey: unreadKeys.all });
    } else toast.success(targets.length === 1 ? "Marked 1 conversation as read" : `Marked ${targets.length} conversations as read`);
  }, [items, queryClient]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "/") {
        e.preventDefault();
        setOpen(!useUiStore.getState().shortcutsOpen);
        return;
      }

      // The footer promises "?" reopens the sheet, so it has to work — but only
      // outside a field, or typing a question mark would open it.
      if (e.key === "?" && !mod && !e.altKey && !inEditableTarget(e.target)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().shortcutsOpen);
        return;
      }

      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const unreads = e.shiftKey ? (queryClient.getQueryData<UnreadMap>(unreadKeys.all) ?? {}) : undefined;
        const target = nextItem(items, pathname, dir, unreads);
        e.preventDefault();
        if (target) router.push(target.href);
        else if (e.shiftKey) toast("Nothing unread", { description: "You're all caught up." });
        return;
      }

      const actions = !mod && !e.altKey && !e.shiftKey && !e.repeat ? MESSAGE_ACTIONS[e.key.toLowerCase()] : undefined;
      if (actions) {
        if (inEditableTarget(e.target) || useUiStore.getState().paletteOpen || document.querySelector("[role='dialog']")) return;
        const row = hoveredMessage();
        if (!row) return;
        // Absent buttons are absent permissions (someone else's message has no Edit), so a miss is a no-op.
        const button = actions.map((label) => row.querySelector<HTMLElement>(`[aria-label="${label}"]`)).find((b) => b !== null);
        if (!button) return;
        e.preventDefault();
        button.click();
        return;
      }

      if (e.key !== "Escape" || open || useUiStore.getState().paletteOpen) return;
      if (inEditableTarget(e.target) || document.querySelector("[role='dialog']")) return;
      if (e.shiftKey) {
        e.preventDefault();
        void markAllRead();
        return;
      }
      // A side panel owns plain Esc (it closes); otherwise the open pane marks itself read.
      if (searchParams.get("thread") || searchParams.get("panel")) return;
      window.dispatchEvent(new CustomEvent(MARK_READ_EVENT));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, markAllRead, open, pathname, queryClient, router, searchParams, setOpen]);

  return <ShortcutsDialog open={open} onOpenChange={setOpen} />;
}

/** The design's kbd chip: 20px square-ish, r5, --bg-subtle behind --border-strong, 11/600 --fg-400. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-[20px] min-w-[20px] place-items-center rounded-[5px] border border-border-strong bg-bg-subtle px-[5px] font-sans text-[11px] font-semibold text-fg-400">
      {children}
    </kbd>
  );
}

function Combo({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-[3px]">
      {keys.map((k, i) => (
        <Key key={i}>{k}</Key>
      ))}
    </span>
  );
}

/**
 * Cmd+/ overlay, from the design's shortcuts sheet: a 620px r14 dialog whose body
 * is one two-column grid of four uppercase groups — Navigation, Messages, Composer,
 * Formatting, in that order — each row a 13px --body label with its kbd chips
 * right-aligned, and a footer that says how to reopen it. A real grid (not two
 * stacked columns) is what keeps the second row's two overlines on one baseline.
 * Every binding listed here is one the app implements.
 */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  const alt = isMac() ? "⌥" : "Alt";
  type Section = { title: string; rows: { keys: string[][]; label: string }[] };
  const sections: Section[] = [
    {
      title: "Navigation",
      rows: [
        { keys: [[mod, "K"]], label: "Jump to a channel or person" },
        // Both directions on one row: the second chip carries only the arrow, the
        // modifier being understood from the first — it keeps the row inside the column.
        { keys: [[alt, "↓"], ["↑"]], label: "Next / previous channel" },
        { keys: [[alt, "⇧", "↓"], ["↑"]], label: "Next / previous unread" },
        { keys: [["esc"]], label: "Mark as read, or close the side panel" },
        { keys: [["⇧", "esc"]], label: "Mark everything as read" },
      ],
    },
    {
      title: "Messages",
      rows: [
        { keys: [["T"]], label: "Reply in thread" },
        { keys: [["R"]], label: "Add reaction" },
        { keys: [["E"]], label: "Edit message" },
        { keys: [["S"]], label: "Save for later" },
      ],
    },
    {
      title: "Composer",
      rows: [
        { keys: [["↵"]], label: "Send" },
        { keys: [["⇧", "↵"]], label: "New line" },
        { keys: [["@"]], label: "Mention someone" },
        { keys: [[":"]], label: "Insert an emoji" },
      ],
    },
    {
      title: "Formatting",
      rows: [
        { keys: [[mod, "B"]], label: "Bold" },
        { keys: [[mod, "I"]], label: "Italic" },
        { keys: [[mod, "⇧", "X"]], label: "Strikethrough" },
        { keys: [[mod, "E"]], label: "Inline code" },
        { keys: [[mod, alt, "C"]], label: "Code block" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[14px] sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything here is reachable without the mouse.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-1 items-start gap-x-[28px] gap-y-[18px] pt-[2px] sm:grid-cols-2">
            {sections.map((s) => (
              <section key={s.title}>
                <h3 className="mb-[4px] text-[11.5px] font-bold tracking-[0.05em] uppercase text-muted-foreground">{s.title}</h3>
                <ul>
                  {s.rows.map((r) => (
                    <li key={r.label} className="flex items-center gap-[10px] py-[6px]">
                      <span className="min-w-0 flex-1 text-[13px] text-body">{r.label}</span>
                      <span className="flex shrink-0 items-center gap-[6px]">
                        {r.keys.map((combo, i) => (
                          <span key={i} className="flex items-center gap-[6px]">
                            {i > 0 && <span className="text-[11px] text-muted-foreground">/</span>}
                            <Combo keys={combo} />
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogBody>
        <DialogFooter showCloseButton className="sm:justify-between">
          <p className="min-w-0 flex-1 text-[12px] text-muted-foreground">
            Press <Key>?</Key> any time to reopen this.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

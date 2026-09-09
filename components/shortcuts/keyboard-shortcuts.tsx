"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
 * Global keys (§5 Phase 3): Cmd+/ overlay, Alt+↑/↓ to move through the
 * sidebar, Alt+Shift+↑/↓ through unreads, Esc to mark the open channel read,
 * Shift+Esc to mark everything read. Composer and dialogs keep their own keys.
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

      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const unreads = e.shiftKey ? (queryClient.getQueryData<UnreadMap>(unreadKeys.all) ?? {}) : undefined;
        const target = nextItem(items, pathname, dir, unreads);
        e.preventDefault();
        if (target) router.push(target.href);
        else if (e.shiftKey) toast("Nothing unread", { description: "You're all caught up." });
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

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-[12px] font-medium text-foreground shadow-[inset_0_-1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

function Combo({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[11px] text-muted-foreground">+</span>}
          <Key>{k}</Key>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  const alt = isMac() ? "⌥" : "Alt";
  const sections: { title: string; rows: { keys: string[][]; label: string }[] }[] = [
    {
      title: "Navigate",
      rows: [
        { keys: [[mod, "K"]], label: "Jump to a channel or person" },
        { keys: [[alt, "↑ ↓"]], label: "Previous / next channel" },
        { keys: [[alt, "⇧", "↑ ↓"]], label: "Previous / next unread" },
        { keys: [["Esc"]], label: "Mark as read, or close the side panel" },
        { keys: [["⇧", "Esc"]], label: "Mark everything as read" },
        { keys: [[mod, "/"]], label: "Show this list" },
      ],
    },
    {
      title: "Write",
      rows: [
        { keys: [["Enter"]], label: "Send" },
        { keys: [["⇧", "Enter"]], label: "New line" },
        { keys: [[mod, "B"]], label: "Bold" },
        { keys: [[mod, "I"]], label: "Italic" },
        { keys: [[mod, "⇧", "X"]], label: "Strikethrough" },
        { keys: [[mod, "E"]], label: "Inline code" },
        { keys: [[mod, alt, "C"]], label: "Code block" },
        { keys: [["@"]], label: "Mention someone" },
        { keys: [[":"]], label: "Insert an emoji" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" aria-describedby={undefined}>
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px] text-muted-foreground">Press {mod}+/ any time to open this.</DialogDescription>
        </div>
        <div className="grid gap-8 px-5 py-4 sm:grid-cols-2">
          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{s.title}</h3>
              <ul className="mt-2 space-y-2.5">
                {s.rows.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 text-foreground">{r.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {r.keys.map((combo, i) => (
                        <span key={i} className="flex items-center gap-1.5">
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
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiStore } from "@/lib/store/ui";

/** Opens the quick switcher; shows the platform's shortcut. */
export function SidebarSearchButton() {
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-white/[0.04] px-2.5 text-[13px] text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Search className="size-3.5" aria-hidden="true" />
      <span className="flex-1 text-left">Search Commune</span>
      <kbd className="rounded border border-sidebar-border px-1 font-sans text-[11px]">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  );
}

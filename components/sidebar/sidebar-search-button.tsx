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
      className="flex h-[34px] w-full items-center gap-[8px] rounded-md border border-border-strong bg-bg-card px-[10px] text-[13.5px] text-muted-foreground shadow-xs transition-colors hover:border-border-hover"
    >
      <Search className="size-[15px] shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate text-left">Search Commune</span>
      <kbd className="shrink-0 rounded-sm border border-border-strong bg-bg-subtle px-[5px] py-px font-sans text-[11px] font-medium text-fg-600">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

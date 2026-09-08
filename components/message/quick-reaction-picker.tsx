"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** A small, fast set for now; the full emoji picker with :shortcode: search comes with the composer. */
export const QUICK_EMOJI = ["👍", "✅", "👀", "🎉", "❤️", "😂", "🔥", "🙏", "💯", "🤔", "👏", "😮"];

export function QuickReactionPicker({ children, onPick }: { children: React.ReactNode; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-1.5">
        <div role="listbox" aria-label="Pick a reaction" className="grid grid-cols-6 gap-0.5">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              role="option"
              aria-selected={false}
              aria-label={e}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="grid size-8 place-items-center rounded-md text-[18px] hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

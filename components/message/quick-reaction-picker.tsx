"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPicker } from "./emoji-picker";

/** Frequent reactions first; "More" opens the full picker. */
export const QUICK_EMOJI = ["👍", "✅", "👀", "🎉", "❤️", "😂", "🔥", "🙏", "💯", "🤔", "👏", "😮"];

export function QuickReactionPicker({ children, onPick }: { children: React.ReactNode; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  if (full) {
    return (
      <EmojiPicker
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setFull(false);
        }}
        onPick={(e) => {
          onPick(e.native);
          setFull(false);
        }}
      >
        {children}
      </EmojiPicker>
    );
  }

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
        <button
          type="button"
          onClick={() => setFull(true)}
          className="mt-1 w-full rounded-md px-2 py-1 text-left text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          More emoji…
        </button>
      </PopoverContent>
    </Popover>
  );
}

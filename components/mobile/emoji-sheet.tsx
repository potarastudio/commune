"use client";

import { Search } from "lucide-react";
import { useEmojiMart } from "@/components/message/emoji-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet } from "./sheet";

/**
 * Every emoji, in a sheet two thirds of the screen tall (design: Mobile Touch
 * → Reaction picker), so the message you are reacting to stays in view.
 * emoji-mart does the searching and the categories; the studio's own emoji
 * come along as a category of their own.
 */
export function EmojiSheet({
  open,
  onOpenChange,
  title = "Choose a reaction",
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onPick: (emoji: string) => void;
}) {
  const { mod, custom, theme } = useEmojiMart(open);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} blur={false} maxHeight="66dvh" className="h-[66dvh]">
      <div className="emoji-sheet flex min-h-0 flex-1 justify-center overflow-hidden px-[6px]">
        {mod ? (
          <mod.Picker
            data={mod.data}
            custom={custom}
            theme={theme}
            previewPosition="none"
            skinTonePosition="search"
            navPosition="bottom"
            maxFrequentRows={2}
            perLine={8}
            emojiSize={26}
            emojiButtonSize={44}
            dynamicWidth
            onEmojiSelect={(e: { native?: string; id: string }) => {
              onPick(e.native ?? `:${e.id}:`);
              onOpenChange(false);
            }}
          />
        ) : (
          <div className="w-full px-[10px]" aria-label="Loading emoji">
            <div className="flex h-[44px] items-center gap-[10px] rounded-[12px] border border-border-strong bg-bg-chip px-[13px] text-[14.5px] text-muted-foreground">
              <Search className="size-[17px]" aria-hidden="true" />
              Search emoji
            </div>
            <div className="mt-[16px] grid grid-cols-8 gap-[4px]">
              {Array.from({ length: 32 }).map((_, i) => (
                <Skeleton key={i} className="h-[40px] rounded-[11px]" />
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

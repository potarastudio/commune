"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEmoji } from "@/lib/composer/emoji";
import { useCustomEmoji } from "@/lib/queries/custom-emoji";

type PickerModule = typeof import("@emoji-mart/react");

/** Full emoji picker (emoji-mart), loaded on first open. */
export function EmojiPicker({
  children,
  onPick,
  open,
  onOpenChange,
  side = "top",
  align = "start",
}: {
  children: React.ReactNode;
  onPick: (emoji: { native: string; id: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom";
  align?: "start" | "end";
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { resolvedTheme } = useTheme();
  const { data: customEmoji } = useCustomEmoji();
  const custom = customEmoji?.length
    ? [{ id: "potara", name: "Potara", emojis: customEmoji.map((e) => ({ id: e.name, name: e.name.replace(/_/g, " "), keywords: [e.name], skins: [{ src: e.url }] })) }]
    : undefined;
  const [mod, setMod] = useState<{ Picker: PickerModule["default"]; data: unknown } | null>(null);

  useEffect(() => {
    if (!isOpen || mod) return;
    void Promise.all([import("@emoji-mart/react"), loadEmoji()]).then(([picker, emoji]) =>
      setMod({ Picker: picker.default, data: emoji.data }),
    );
  }, [isOpen, mod]);

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        className="emoji-picker-popover w-auto overflow-hidden rounded-xl border-border bg-bg-card p-0 shadow-lg"
      >
        {mod ? (
          <mod.Picker
            data={mod.data}
            custom={custom}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={2}
            perLine={8}
            autoFocus
            onEmojiSelect={(e: { native?: string; id: string }) => {
              // Custom emoji have no unicode form; they travel as ":name:" (§4 reactions.emoji).
              onPick({ native: e.native ?? `:${e.id}:`, id: e.id });
              setOpen(false);
            }}
          />
        ) : (
          <div className="w-[332px]" aria-label="Loading emoji">
            <div className="border-b border-border-subtle p-2">
              <div className="flex h-8 items-center gap-[7px] rounded-md border border-border-strong bg-bg-chip px-[9px]">
                <Search className="size-[14px] shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-[13px] text-muted-foreground">Search emoji</span>
              </div>
            </div>
            <p className="px-3 pb-[5px] pt-[9px] text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              Frequently used
            </p>
            <div className="grid grid-cols-8 gap-0.5 px-2 pb-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-[7px]" />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

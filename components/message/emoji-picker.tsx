"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
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
      <PopoverContent side={side} align={align} className="w-auto overflow-hidden p-0 emoji-picker-popover" sideOffset={6}>
        {mod ? (
          <mod.Picker
            data={mod.data}
            custom={custom}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={2}
            perLine={9}
            autoFocus
            onEmojiSelect={(e: { native?: string; id: string }) => {
              // Custom emoji have no unicode form; they travel as ":name:" (§4 reactions.emoji).
              onPick({ native: e.native ?? `:${e.id}:`, id: e.id });
              setOpen(false);
            }}
          />
        ) : (
          <div className="w-[352px] space-y-2 p-3" aria-label="Loading emoji">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

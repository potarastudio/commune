"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { previewSound } from "@/lib/audio/sounds";
import { SOUND_LABELS, SOUND_NAMES, useSoundStore, type SoundName } from "@/lib/store/sounds";
import { useHydrated } from "@/lib/utils/use-hydrated";

/**
 * The design's first Delivery row: "Sound" on the left, a 34px picker chip on
 * the right showing the current tone with a chevron, no note. Choosing a tone
 * plays it, so the picker doubles as the preview and as the user gesture the
 * browser needs before the page is allowed to make any sound at all.
 *
 * The chip mirrors the member-role picker, which is the same control in the
 * design's Members card.
 */
const ROW = "flex flex-wrap items-center gap-4 px-4 py-[14px]";
const LABEL = "block text-[13.5px] font-semibold text-ink";

export function SoundRow({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const mobile = variant === "mobile";
  const hydrated = useHydrated();
  const sound = useSoundStore((s) => s.sound);
  const setSound = useSoundStore((s) => s.setSound);
  // The choice lives in this browser only, so the server paints the default and
  // the real value replaces it a frame after hydration.
  const shown: SoundName = hydrated ? sound : "ping";

  return (
    <div
      className={
        mobile ? "flex min-h-[52px] items-center gap-[14px] border-t border-border-subtle px-[16px] py-[11px]" : ROW
      }
    >
      <span className={mobile ? "min-w-0 flex-1" : "min-w-[180px] flex-1"}>
        <span className={mobile ? "block text-[14.5px] font-medium text-ink" : LABEL}>Sound</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Notification sound: ${SOUND_LABELS[shown]}`}
            className={`flex shrink-0 items-center gap-2 border border-border-input bg-bg-card font-medium text-ink shadow-xs transition-colors hover:bg-bg-card-hover ${
              mobile ? "h-[40px] rounded-[10px] px-[12px] text-[14px]" : "h-[34px] rounded-[8px] px-[10px] text-[13px]"
            }`}
          >
            {SOUND_LABELS[shown]}
            <ChevronDown className="size-[13px] text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuRadioGroup
            value={shown}
            onValueChange={(value) => {
              const next = value as SoundName;
              setSound(next);
              void previewSound(next);
            }}
          >
            {SOUND_NAMES.map((name) => (
              <DropdownMenuRadioItem key={name} value={name}>
                {SOUND_LABELS[name]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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

export function SoundRow() {
  const hydrated = useHydrated();
  const sound = useSoundStore((s) => s.sound);
  const setSound = useSoundStore((s) => s.setSound);
  // The choice lives in this browser only, so the server paints the default and
  // the real value replaces it a frame after hydration.
  const shown: SoundName = hydrated ? sound : "ping";

  return (
    <div className={ROW}>
      <span className="min-w-[180px] flex-1">
        <span className={LABEL}>Sound</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Notification sound: ${SOUND_LABELS[shown]}`}
            className="flex h-[34px] shrink-0 items-center gap-2 rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13px] font-medium text-ink shadow-xs transition-colors hover:bg-bg-card-hover"
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

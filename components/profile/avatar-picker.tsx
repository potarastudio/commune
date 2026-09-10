"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadAvatar } from "@/lib/queries/avatar";
import { humanError } from "@/lib/utils/human-error";

/**
 * Photo block (§6, Settings design): a 64px round avatar with the name and the
 * action pair beside it — "Change photo" as a 30px outline button, "Remove" as
 * a ghost that turns danger on hover. The whole avatar is still the picker, so
 * clicking the image works as it always did.
 *
 * `headingKind` sizes the heading: "name" is the 15px person's name the
 * Settings design draws, "label" the 13.5px field heading the New Member Setup
 * design uses over "Profile photo".
 */
export function AvatarPicker({
  userId,
  value,
  fallback,
  onChange,
  heading,
  headingKind = "name",
  meta,
  hint,
  showPresence = false,
}: {
  userId: string;
  value: string | null;
  fallback: string;
  onChange: (url: string | null) => void;
  heading?: React.ReactNode;
  headingKind?: "name" | "label";
  meta?: React.ReactNode;
  hint?: React.ReactNode;
  showPresence?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadAvatar(userId, file));
    } catch (err) {
      toast.error("Couldn't upload that photo", { description: humanError(err, "Try again in a moment.") });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={value ? "Change photo" : "Add a photo"}
        className="group relative shrink-0 rounded-full"
      >
        <Avatar size="3xl">
          <AvatarImage src={value ?? undefined} alt="" />
          <AvatarFallback className="bg-accent-surface font-semibold text-accent-foreground">{fallback}</AvatarFallback>
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {busy ? (
              <Loader2 className="size-[21px] commune-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-[21px]" aria-hidden="true" />
            )}
          </span>
        </Avatar>
        {/* The dot sits outside the clipped avatar, as the design draws it. */}
        {showPresence && (
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-0 size-[14px] rounded-full border-[2.5px] border-bg-card bg-presence"
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        {heading ? (
          <p className={`truncate font-semibold text-ink ${headingKind === "label" ? "text-[13.5px]" : "text-[15px]"}`}>{heading}</p>
        ) : null}
        {meta ? <p className="mt-[2px] truncate text-[12.5px] text-fg-600">{meta}</p> : null}
        <div className="mt-[9px] flex flex-wrap items-center gap-[7px]">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-[30px] items-center rounded-[8px] border border-border-strong bg-bg-card px-[11px] text-[12.5px] font-semibold text-ink shadow-xs transition-colors hover:border-border-hover hover:bg-bg-card-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? "Uploading…" : value ? "Change photo" : "Upload a photo"}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex h-[30px] items-center rounded-[8px] px-[9px] text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-bg-subtle hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
        {hint ? <p className="mt-[7px] text-[12px] leading-[1.5] text-fg-600">{hint}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}

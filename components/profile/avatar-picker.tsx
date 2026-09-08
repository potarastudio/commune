"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadAvatar } from "@/lib/queries/avatar";

export function AvatarPicker({
  userId,
  value,
  fallback,
  onChange,
}: {
  userId: string;
  value: string | null;
  fallback: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadAvatar(userId, file));
    } catch (err) {
      toast.error("Couldn't upload that image", { description: err instanceof Error ? err.message : undefined });
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
        className="group relative rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Avatar className="size-20 rounded-xl">
          <AvatarImage src={value ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="rounded-xl bg-accent text-[24px] font-semibold text-accent-foreground">
            {fallback}
          </AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
        </span>
      </button>
      <div className="text-[13px]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="font-medium text-link underline-offset-2 hover:underline"
        >
          {busy ? "Uploading…" : value ? "Change photo" : "Upload a photo"}
        </button>
        <p className="text-muted-foreground">Square works best. PNG or JPG, under 5 MB.</p>
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

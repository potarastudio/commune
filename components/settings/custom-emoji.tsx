"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteCustomEmojiAction } from "@/lib/actions/custom-emoji";
import { customEmojiKeys, uploadCustomEmoji, useCustomEmoji, type CustomEmoji } from "@/lib/queries/custom-emoji";
import { useProfileMap } from "@/lib/queries/profiles";
import { CUSTOM_EMOJI_TYPES, emojiNameFromFile, emojiNameProblem } from "@/lib/utils/custom-emoji";
import { humanError } from "@/lib/utils/human-error";

/** Settings → Custom emoji (§5 Phase 3). Anyone adds; the person who added one, or an admin, removes it. */
export function CustomEmojiSettings({ meId, isAdmin }: { meId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data: emoji, isPending } = useCustomEmoji();
  const profiles = useProfileMap();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, startRemove] = useTransition();

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f && !name) setName(emojiNameFromFile(f.name));
  };

  const reset = () => {
    pick(null);
    setName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose an image first");
      return;
    }
    const problem = emojiNameProblem(name);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const created = await uploadCustomEmoji({ name, file, userId: meId });
      queryClient.setQueryData<CustomEmoji[]>(customEmojiKeys.all, (old) => [...(old ?? []).filter((x) => x.name !== created.name), created].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`:${created.name}: added`, { description: "Type it in a message, or find it under Potara in the emoji picker." });
      reset();
    } catch (err) {
      toast.error("Couldn't add that emoji", { description: humanError(err, "Try again in a moment.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = (target: CustomEmoji) =>
    startRemove(async () => {
      const result = await deleteCustomEmojiAction({ name: target.name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      queryClient.setQueryData<CustomEmoji[]>(customEmojiKeys.all, (old) => (old ?? []).filter((x) => x.name !== target.name));
      toast.success(`:${target.name}: removed`);
    });

  const problem = name ? emojiNameProblem(name) : null;

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-start gap-3 rounded-[12px] border border-border bg-bg-card p-4 shadow-xs">
        <input
          ref={fileRef}
          type="file"
          accept={CUSTOM_EMOJI_TYPES.join(",")}
          className="sr-only"
          aria-label="Emoji image"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={file ? "Change image" : "Choose image"}
          title={file ? "Change image" : "Choose image"}
          className="mt-[19px] grid size-[56px] shrink-0 place-items-center rounded-[12px] border border-dashed border-border-input bg-bg-card text-muted-foreground transition-colors hover:border-border-hover hover:text-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="size-[36px] object-contain" /> : <ImagePlus className="size-[21px]" aria-hidden="true" />}
        </button>

        <div className="min-w-[180px] flex-1">
          <Label htmlFor="emoji-name" className="mb-[6px]">
            Name
          </Label>
          <div className="field-focus flex h-[34px] w-fit max-w-full items-center rounded-[8px] border border-border-input bg-bg-card px-[10px] font-mono text-[13px] text-body shadow-xs">
            <span className="shrink-0 text-muted-foreground">:</span>
            <input
              id="emoji-name"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="party_parrot"
              spellCheck={false}
              aria-invalid={Boolean(problem)}
              aria-describedby="emoji-name-hint"
              className="field-sizing-content h-full min-w-[110px] max-w-full bg-transparent px-[2px] outline-none placeholder:text-muted-foreground"
            />
            <span className="shrink-0 text-muted-foreground">:</span>
          </div>
          <p id="emoji-name-hint" className={`mt-[6px] text-[12px] leading-[1.5] ${problem ? "text-danger" : "text-fg-600"}`}>
            {problem ?? "PNG, GIF, WebP or JPEG, under 256 KB. Square images look best."}
          </p>
        </div>

        <Button type="submit" disabled={busy || !file || Boolean(problem)} className="mt-[19px]">
          {busy ? "Adding…" : "Add emoji"}
        </Button>
      </form>

      {isPending ? (
        <ul className="mt-3 grid grid-cols-1 gap-[9px] sm:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="commune-pulse flex items-center gap-[10px] rounded-[10px] border border-border bg-bg-card px-[10px] py-2">
              <span className="size-[28px] shrink-0 rounded-[6px] bg-bg-subtle" />
              <span className="h-[10px] w-[42%] rounded-full bg-bg-subtle" />
            </li>
          ))}
        </ul>
      ) : (emoji ?? []).length === 0 ? (
        <p className="mt-3 rounded-[12px] border border-dashed border-border-input px-4 py-6 text-center text-[13px] leading-[1.5] text-fg-600">
          No custom emoji yet. Add the studio&apos;s first one above. It works in messages and reactions for everyone.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-[9px] sm:grid-cols-2">
          {(emoji ?? []).map((e) => {
            const by = e.created_by ? profiles.get(e.created_by)?.display_name : null;
            const canRemove = isAdmin || e.created_by === meId;
            return (
              <li
                key={e.name}
                className="group/emoji flex items-center gap-[10px] rounded-[10px] border border-border bg-bg-card px-[10px] py-2 shadow-xs transition-colors hover:border-border-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.url} alt={`:${e.name}:`} className="size-[28px] shrink-0 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12.5px] text-ink">:{e.name}:</span>
                  {by && <span className="block truncate text-[11.5px] text-fg-600">by {by}</span>}
                </span>
                {canRemove && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => remove(e)}
                        aria-label={`Remove :${e.name}:`}
                        // No `disabled:opacity-50` here: the variant would beat the base `opacity-0`
                        // and flash every hidden button in during a pending removal.
                        className="grid size-[28px] shrink-0 place-items-center rounded-[6px] text-fg-600 opacity-0 transition-[opacity,background-color,color] hover:bg-danger-surface hover:text-danger focus-visible:opacity-100 group-hover/emoji:opacity-100 disabled:pointer-events-none"
                      >
                        <Trash2 className="size-[15px]" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Remove</TooltipContent>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

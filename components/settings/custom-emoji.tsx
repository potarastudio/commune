"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteCustomEmojiAction } from "@/lib/actions/custom-emoji";
import { customEmojiKeys, uploadCustomEmoji, useCustomEmoji, type CustomEmoji } from "@/lib/queries/custom-emoji";
import { useProfileMap } from "@/lib/queries/profiles";
import { CUSTOM_EMOJI_TYPES, emojiNameFromFile, emojiNameProblem } from "@/lib/utils/custom-emoji";

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
      toast.error("Choose an image first.");
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
      toast.error("Couldn't add that emoji", { description: err instanceof Error ? err.message : undefined });
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
    <div className="space-y-5">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
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
          className="grid size-14 shrink-0 place-items-center rounded-md border border-dashed border-input bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="size-8 object-contain" /> : <ImagePlus className="size-5" aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="emoji-name" className="text-[12px] text-muted-foreground">
            Name
          </label>
          <div className="flex h-9 items-center rounded-md border border-input bg-background pl-2.5 font-mono text-[13px] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
            <span className="text-muted-foreground">:</span>
            <input
              id="emoji-name"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              placeholder="party_parrot"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent px-0.5 outline-none placeholder:text-muted-foreground"
            />
            <span className="pr-2.5 text-muted-foreground">:</span>
          </div>
          <p className={`text-[12px] ${problem ? "text-destructive" : "text-muted-foreground"}`}>
            {problem ?? "PNG, GIF, WebP or JPEG, under 256 KB. Square images look best."}
          </p>
        </div>
        <Button type="submit" size="sm" disabled={busy || !file || Boolean(problem)} className="mb-5">
          {busy ? "Adding…" : "Add emoji"}
        </Button>
      </form>

      {isPending ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : (emoji ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          No custom emoji yet. Add the studio&apos;s first one above. It works in messages and reactions for everyone.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(emoji ?? []).map((e) => {
            const by = e.created_by ? profiles.get(e.created_by)?.display_name : null;
            const canRemove = isAdmin || e.created_by === meId;
            return (
              <li key={e.name} className="group/emoji flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.url} alt={`:${e.name}:`} className="size-7 shrink-0 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12.5px]">:{e.name}:</span>
                  {by && <span className="block truncate text-[11px] text-muted-foreground">by {by}</span>}
                </span>
                {canRemove && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => remove(e)}
                        aria-label={`Remove :${e.name}:`}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/emoji:opacity-100"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
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

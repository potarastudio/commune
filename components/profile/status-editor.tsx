"use client";

import { useQueryClient } from "@tanstack/react-query";
import { SmilePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmojiPicker } from "@/components/message/emoji-picker";
import { Button } from "@/components/ui/button";
import { setStatusAction } from "@/lib/actions/profile";
import type { Profile } from "@/lib/queries/profile";
import { profileKeys } from "@/lib/queries/profiles";
import { STATUS_EXPIRY_OPTIONS, STATUS_TEXT_MAX, isStatusActive, statusExpiresAt, type StatusExpiry } from "@/lib/utils/status";

const PRESETS: { emoji: string; text: string; expiry: StatusExpiry }[] = [
  { emoji: "🗓️", text: "In a meeting", expiry: "1h" },
  { emoji: "🎧", text: "Focusing", expiry: "4h" },
  { emoji: "🍜", text: "Lunch", expiry: "1h" },
  { emoji: "🤒", text: "Out sick", expiry: "today" },
  { emoji: "🏝️", text: "On holiday", expiry: "week" },
];

/** Status editor (§5 Phase 3): emoji + text + when it clears. Lives in a popover off the account block. */
export function StatusEditor({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const active = isStatusActive(profile);
  const [emoji, setEmoji] = useState<string | null>(active ? profile.status_emoji : null);
  const [text, setText] = useState(active ? (profile.status_text ?? "") : "");
  const [expiry, setExpiry] = useState<StatusExpiry>("today");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const finish = (result: { ok: true } | { ok: false; error: string }, message: string) => {
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    router.refresh();
    toast.success(message);
    onDone();
  };

  const save = () =>
    startTransition(async () => {
      const cleaned = text.trim();
      if (!emoji && !cleaned) {
        toast.error("Add an emoji or a few words first.");
        return;
      }
      finish(await setStatusAction({ emoji, text: cleaned || null, expiresAt: statusExpiresAt(expiry, new Date(), profile.timezone) }), "Status set");
    });

  const clear = () =>
    startTransition(async () => {
      finish(await setStatusAction({ emoji: null, text: null, expiresAt: null }), "Status cleared");
    });

  return (
    <form
      className="w-80 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold">{active ? "Edit your status" : "Set a status"}</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex h-9 items-center rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
        <EmojiPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={(e) => setEmoji(e.native)} side="bottom">
          <button
            type="button"
            aria-label={emoji ? "Change emoji" : "Pick an emoji"}
            className="grid size-9 shrink-0 place-items-center rounded-l-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {emoji ? (
              <span role="img" aria-hidden="true" className="text-[17px] leading-none">
                {emoji}
              </span>
            ) : (
              <SmilePlus className="size-4" aria-hidden="true" />
            )}
          </button>
        </EmojiPicker>
        <input
          autoFocus
          value={text}
          maxLength={STATUS_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's your status?"
          aria-label="Status text"
          className="h-full min-w-0 flex-1 bg-transparent pr-2 text-[13px] outline-none placeholder:text-muted-foreground"
        />
        {(emoji || text) && (
          <button
            type="button"
            onClick={() => {
              setEmoji(null);
              setText("");
            }}
            aria-label="Clear fields"
            className="mr-1 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-0.5" aria-label="Suggestions">
        {PRESETS.map((s) => (
          <li key={s.text}>
            <button
              type="button"
              onClick={() => {
                setEmoji(s.emoji);
                setText(s.text);
                setExpiry(s.expiry);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span role="img" aria-hidden="true" className="text-[15px] leading-none">
                {s.emoji}
              </span>
              <span className="flex-1">{s.text}</span>
              <span className="text-[12px] text-muted-foreground">{STATUS_EXPIRY_OPTIONS.find((o) => o.value === s.expiry)?.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <label className="mt-3 flex items-center justify-between gap-3 px-1 text-[12px] text-muted-foreground">
        Clear after
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value as StatusExpiry)}
          className="h-7 rounded-md border border-input bg-background px-2 text-[12px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        >
          {STATUS_EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 flex justify-end gap-2">
        {active && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={clear}>
            Clear status
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

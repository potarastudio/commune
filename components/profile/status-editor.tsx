"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, SmilePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmojiPicker } from "@/components/message/emoji-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      className="w-[320px] overflow-hidden rounded-[14px]"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-center gap-[11px] border-b border-border-subtle px-[14px] py-[13px]">
        <span className="relative block shrink-0">
          <Avatar size="lg">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-accent-surface text-[13px] font-semibold text-accent-foreground">
              {profile.display_name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span aria-hidden="true" className="absolute right-0 bottom-0 size-[10px] rounded-full border-2 border-bg-card bg-presence" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">{profile.display_name}</span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {active ? "Edit your status" : "Set a status"}
          </span>
        </span>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="grid size-[26px] shrink-0 place-items-center rounded-[6px] text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
        >
          <X className="size-[13px]" aria-hidden="true" />
        </button>
      </div>

      <div className="px-[14px] pb-1 pt-3">
        <div className="field-focus flex h-[38px] items-center gap-[9px] rounded-[10px] border border-border-input bg-bg-card pl-[6px] pr-[8px] shadow-xs">
          <EmojiPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={(e) => setEmoji(e.native)} side="bottom">
            <button
              type="button"
              aria-label={emoji ? "Change emoji" : "Pick an emoji"}
              className="grid size-[28px] shrink-0 place-items-center rounded-[6px] text-fg-600 transition-colors hover:bg-bg-subtle hover:text-ink"
            >
              {emoji ? (
                <span role="img" aria-hidden="true" className="text-[15px] leading-none">
                  {emoji}
                </span>
              ) : (
                <SmilePlus className="size-[15px]" aria-hidden="true" />
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
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-body outline-none placeholder:text-muted-foreground"
          />
          {(emoji || text) && (
            <button
              type="button"
              onClick={() => {
                setEmoji(null);
                setText("");
              }}
              aria-label="Clear fields"
              className="grid size-[24px] shrink-0 place-items-center rounded-[6px] text-muted-foreground transition-colors hover:bg-bg-subtle hover:text-ink"
            >
              <X className="size-[13px]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="px-2 pb-1 pt-2">
        <p className="mb-[2px] px-[6px] text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Suggestions</p>
        <ul aria-label="Suggestions">
          {PRESETS.map((s) => {
            const chosen = emoji === s.emoji && text === s.text;
            return (
              <li key={s.text}>
                <button
                  type="button"
                  onClick={() => {
                    setEmoji(s.emoji);
                    setText(s.text);
                    setExpiry(s.expiry);
                  }}
                  className={`flex w-full items-center gap-[10px] rounded-[8px] px-[9px] py-2 text-left transition-colors ${
                    chosen ? "bg-accent-surface" : "hover:bg-bg-subtle"
                  }`}
                >
                  <span role="img" aria-hidden="true" className="shrink-0 text-[15px] leading-none">
                    {s.emoji}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${chosen ? "font-semibold text-accent-foreground" : "font-medium text-ink"}`}>
                    {s.text}
                  </span>
                  <span className={`shrink-0 text-[11.5px] ${chosen ? "text-accent-foreground" : "text-muted-foreground"}`}>
                    {STATUS_EXPIRY_OPTIONS.find((o) => o.value === s.expiry)?.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-2 px-[14px] pb-3 pt-2">
        <label htmlFor="status-expiry" className="shrink-0 text-[12px] text-fg-600">
          Clear after
        </label>
        <div className="field-focus relative flex h-[30px] min-w-0 flex-1 items-center rounded-[8px] border border-border-input bg-bg-card shadow-xs">
          <select
            id="status-expiry"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value as StatusExpiry)}
            className="h-full w-full appearance-none rounded-[8px] bg-transparent pl-[9px] pr-[26px] text-[12.5px] font-medium text-ink outline-none"
          >
            {STATUS_EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-[8px] size-[13px] text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border-subtle bg-bg-col px-[14px] py-[10px]">
        {active ? (
          <span className="flex-1" aria-hidden="true" />
        ) : (
          <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">Shown next to your name.</p>
        )}
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

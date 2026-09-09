"use client";

import { Bookmark, BookmarkCheck, Link2, MessageSquareText, Pencil, Pin, PinOff, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickReactionPicker } from "./quick-reaction-picker";
import { RemindMenu } from "./remind-menu";

/** 28px icon button with a 15px glyph — the toolbar's only size. */
const ACTION_BUTTON_BASE = "grid size-7 place-items-center rounded-sm text-fg-600 hover:bg-bg-subtle";
export const ACTION_BUTTON_CLASS = `${ACTION_BUTTON_BASE} hover:text-ink`;
/** Delete keeps the neutral hover fill of its siblings; only the glyph turns red (design decision 4). */
const ACTION_BUTTON_DANGER = `${ACTION_BUTTON_BASE} hover:text-danger`;

function ActionButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={danger ? ACTION_BUTTON_DANGER : ACTION_BUTTON_CLASS}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Hover action bar (§5) — floats above the row's top-right corner. */
export function MessageActions({
  messageId,
  canDelete,
  canEdit,
  isPinned,
  isSaved,
  onReact,
  onDelete,
  onReply,
  onEdit,
  onTogglePin,
  onToggleSave,
}: {
  messageId: string;
  canDelete: boolean;
  canEdit: boolean;
  isPinned: boolean;
  isSaved: boolean;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onReply?: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  onToggleSave: () => void;
}) {
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?message=${messageId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div
      /* Stays laid out while one of its menus is open — see data-menu-anchor in globals.css. */
      data-menu-anchor=""
      className="absolute -top-[15px] right-4 hidden items-center gap-0.5 rounded-lg border border-border bg-bg-card p-[3px] shadow-md group-focus-within:flex group-hover:flex md:right-6"
      role="toolbar"
      aria-label="Message actions"
    >
      <QuickReactionPicker onPick={onReact}>
        <button type="button" aria-label="Add reaction" className={ACTION_BUTTON_CLASS}>
          <SmilePlus className="size-[15px]" aria-hidden="true" />
        </button>
      </QuickReactionPicker>
      {onReply && (
        <ActionButton label="Reply in thread" onClick={onReply}>
          <MessageSquareText className="size-[15px]" aria-hidden="true" />
        </ActionButton>
      )}
      <ActionButton label={isSaved ? "Remove from saved" : "Save for later"} onClick={onToggleSave}>
        {isSaved ? (
          <BookmarkCheck className="size-[15px] text-accent-foreground" aria-hidden="true" />
        ) : (
          <Bookmark className="size-[15px]" aria-hidden="true" />
        )}
      </ActionButton>
      <ActionButton label={isPinned ? "Unpin" : "Pin"} onClick={onTogglePin}>
        {isPinned ? <PinOff className="size-[15px]" aria-hidden="true" /> : <Pin className="size-[15px]" aria-hidden="true" />}
      </ActionButton>
      <RemindMenu messageId={messageId} />
      <ActionButton label="Copy link" onClick={() => void copyLink()}>
        <Link2 className="size-[15px]" aria-hidden="true" />
      </ActionButton>
      {(canEdit || canDelete) && <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />}
      {canEdit && (
        <ActionButton label="Edit message" onClick={onEdit}>
          <Pencil className="size-[15px]" aria-hidden="true" />
        </ActionButton>
      )}
      {canDelete && (
        <ActionButton label="Delete message" onClick={onDelete} danger>
          <Trash2 className="size-[15px]" aria-hidden="true" />
        </ActionButton>
      )}
    </div>
  );
}

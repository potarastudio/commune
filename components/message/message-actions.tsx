"use client";

import { Bookmark, BookmarkCheck, Link2, MessageSquareText, Pencil, Pin, PinOff, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickReactionPicker } from "./quick-reaction-picker";
import { RemindMenu } from "./remind-menu";

function ActionButton({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Hover action bar (§5). Reply, edit, pin and save arrive with their features. */
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
      className="absolute -top-3 right-5 hidden items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-sm group-hover:flex group-focus-within:flex"
      role="toolbar"
      aria-label="Message actions"
    >
      <QuickReactionPicker onPick={onReact}>
        <button
          type="button"
          aria-label="Add reaction"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <SmilePlus className="size-4" aria-hidden="true" />
        </button>
      </QuickReactionPicker>
      {onReply && (
        <ActionButton label="Reply in thread" onClick={onReply}>
          <MessageSquareText className="size-4" aria-hidden="true" />
        </ActionButton>
      )}
      <ActionButton label={isSaved ? "Remove from saved" : "Save for later"} onClick={onToggleSave}>
        {isSaved ? <BookmarkCheck className="size-4 text-primary" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
      </ActionButton>
      <ActionButton label={isPinned ? "Unpin" : "Pin"} onClick={onTogglePin}>
        {isPinned ? <PinOff className="size-4" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
      </ActionButton>
      <RemindMenu messageId={messageId} />
      <ActionButton label="Copy link" onClick={() => void copyLink()}>
        <Link2 className="size-4" aria-hidden="true" />
      </ActionButton>
      {canEdit && (
        <ActionButton label="Edit message" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
        </ActionButton>
      )}
      {canDelete && (
        <ActionButton label="Delete message" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden="true" />
        </ActionButton>
      )}
    </div>
  );
}

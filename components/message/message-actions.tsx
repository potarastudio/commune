"use client";

import { Link2, SmilePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickReactionPicker } from "./quick-reaction-picker";

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
  onReact,
  onDelete,
}: {
  messageId: string;
  canDelete: boolean;
  onReact: (emoji: string) => void;
  onDelete: () => void;
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
      <ActionButton label="Copy link" onClick={() => void copyLink()}>
        <Link2 className="size-4" aria-hidden="true" />
      </ActionButton>
      {canDelete && (
        <ActionButton label="Delete message" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden="true" />
        </ActionButton>
      )}
    </div>
  );
}

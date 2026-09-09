"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfileMap } from "@/lib/queries/profiles";
import { describeExpiry, isStatusActive } from "@/lib/utils/status";

/**
 * Someone's status: the emoji alone (tooltip carries the text) or emoji + text.
 * Renders nothing when they have no active status.
 */
export function UserStatus({ userId, withText = false, className = "" }: { userId: string; withText?: boolean; className?: string }) {
  const p = useProfileMap().get(userId);
  if (!p || !isStatusActive(p)) return null;
  const until = describeExpiry(p.status_expires_at, p.timezone);
  const label = [p.status_text, until].filter(Boolean).join(" · ");

  if (withText) {
    return (
      <span className={`inline-flex min-w-0 items-center gap-1 ${className}`} title={until ?? undefined}>
        {p.status_emoji && (
          <span role="img" aria-hidden="true" className="text-[14px] leading-none">
            {p.status_emoji}
          </span>
        )}
        {p.status_text && <span className="truncate">{p.status_text}</span>}
      </span>
    );
  }
  if (!p.status_emoji) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={label || "Status"} className={`inline-block text-[13px] leading-none ${className}`}>
          {p.status_emoji}
        </span>
      </TooltipTrigger>
      {label && <TooltipContent side="top">{label}</TooltipContent>}
    </Tooltip>
  );
}

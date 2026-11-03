import { cn } from "@/lib/utils";

/**
 * The chip beside a service account's name (Potara Hub), drawn like the "YOU"
 * chip beside your own messages: it posts notifications and never reads.
 */
export function AppBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[5px] border border-border-strong bg-bg-chip px-[5px] text-[10.5px] font-semibold tracking-[0.02em] text-fg-600",
        className,
      )}
    >
      APP
    </span>
  );
}

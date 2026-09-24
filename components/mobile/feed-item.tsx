import type { MessageAuthor } from "@/lib/queries/messages";
import { cn } from "@/lib/utils";
import { MobileLink } from "./mobile-link";
import { RoundFace } from "./ui";

/**
 * One row of a phone feed (design: Mobile Core Screens → Activity): a 36px
 * face with an 18px kind badge, an eyebrow naming who and where, the message
 * itself, the quoted message it is about, and the time. The whole row is the
 * link, so what sits inside it is rendered inert.
 */
export function FeedItem({
  href,
  person,
  badge,
  badgeTone = "neutral",
  eyebrow,
  quote,
  time,
  unread = false,
  children,
}: {
  href: string;
  person: Pick<MessageAuthor, "display_name" | "avatar_url"> | null;
  badge?: React.ReactNode;
  badgeTone?: "accent" | "neutral";
  eyebrow: React.ReactNode;
  quote?: React.ReactNode;
  time: string;
  unread?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li>
      <MobileLink href={href} className="flex gap-[12px] border-b border-border-subtle px-[16px] py-[13px] active:bg-bg-hover">
        <span className="relative block size-[36px] shrink-0">
          <RoundFace person={person} size={36} />
          {badge && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -right-[3px] -bottom-[3px] grid size-[18px] place-items-center rounded-full border-2 border-bg-main [&>svg]:size-[9px]",
                badgeTone === "accent" ? "bg-primary text-white" : "bg-bg-avatar text-fg-600",
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] leading-[1.5] text-fg-400">{eyebrow}</div>
          {children && (
            <div className="mt-[4px] line-clamp-4 text-[13.5px] leading-[1.55] text-body [text-wrap:pretty] [&>p]:inline">{children}</div>
          )}
          {quote && (
            <div className="mt-[6px] line-clamp-3 border-l-2 border-border-strong py-px pl-[9px] text-[12.5px] leading-[1.5] text-fg-600 [text-wrap:pretty]">
              {quote}
            </div>
          )}
          <div className="mt-[6px] text-[11.5px] text-muted-foreground tabular-nums">{time}</div>
        </div>
        {unread && (
          <span className="mt-[14px] block size-[8px] shrink-0 rounded-full bg-primary">
            <span className="sr-only">New</span>
          </span>
        )}
      </MobileLink>
    </li>
  );
}

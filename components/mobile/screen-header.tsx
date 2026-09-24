"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHuddleBarOutlet } from "./huddle-bar-slot";
import { useMobileNav } from "./use-mobile-nav";

/**
 * A tab root's header (design: 56px, the section's name at 19/600, actions on
 * the right as 44px targets). Roots have no back button: Back inside a tab
 * only ever walks that tab's stack.
 */
export function RootHeader({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <>
      <header className="flex h-[56px] shrink-0 items-center gap-[4px] border-b border-border bg-bg-main pr-[6px] pl-[16px]">
        <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.025em] text-ink">{title}</h1>
        {children}
      </header>
      {/* A huddle you are in, minimised, sits under whichever header is showing. */}
      <MobileHuddleBarOutlet />
    </>
  );
}

/** A 44px icon button for headers, fg-600 at rest. */
export function HeaderIconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-[44px] shrink-0 place-items-center rounded-[10px] text-fg-600 active:bg-bg-subtle active:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * A pushed screen's header (design: 52px, a 44px back chevron, the title at
 * 15/600 with an 11.5px line under it, actions on the right). `onBack`
 * overrides the stack — a surface closes rather than pops.
 */
export function PushedHeader({
  title,
  subtitle,
  backLabel = "Back",
  onBack,
  leading,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
  /** Drawn between the back button and the title: a DM's avatar. */
  leading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const nav = useMobileNav();
  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center gap-[4px] border-b border-border bg-bg-main pr-[6px] pl-[2px]">
        <HeaderIconButton label={backLabel} onClick={onBack ?? (() => void nav.back())}>
          <ChevronLeft className="size-[20px]" strokeWidth={1.75} aria-hidden="true" />
        </HeaderIconButton>
        {leading}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-[5px] truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">{title}</span>
          {subtitle && <span className="block truncate text-[11.5px] text-muted-foreground">{subtitle}</span>}
        </span>
        {children}
      </header>
      <MobileHuddleBarOutlet />
    </>
  );
}

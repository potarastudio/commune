"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useMobileNav } from "./use-mobile-nav";

/**
 * A link that pushes onto the current tab with the push animation. It is
 * still a real <a href>, so long-press previews, prefetching and opening in a
 * new tab keep working; only a plain tap is taken over.
 */
export function MobileLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const nav = useMobileNav();
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        nav.push(href);
      }}
      {...rest}
    />
  );
}

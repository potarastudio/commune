"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useMobileNav } from "@/components/mobile/use-mobile-nav";
import { useIsMobile } from "@/lib/mobile-context";

export type SidePanel = "pins" | "details";
export type PanelTab = "about" | "members" | "files" | "pins";

const TABS: PanelTab[] = ["about", "members", "files", "pins"];

/**
 * The right-hand panel lives in the URL so links and refreshes keep it:
 * ?thread=<messageId> for a thread, ?panel=details&tab=<tab> for the
 * container details, ?panel=pins as a shortcut to its Pins tab.
 * Only one is open at a time.
 */
export function useThreadNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // On the phone a thread and a conversation's details are screens of their own,
  // pushed with the animation and popped with Back.
  const mobile = useIsMobile();
  const nav = useMobileNav();
  const openThreadId = searchParams.get("thread");
  const rawPanel = searchParams.get("panel");
  const openPanel: SidePanel | null = rawPanel === "pins" || rawPanel === "details" ? rawPanel : null;
  const rawTab = searchParams.get("tab");
  const panelTab: PanelTab | null = openPanel === "pins" ? "pins" : openPanel === "details" ? (TABS.includes(rawTab as PanelTab) ? (rawTab as PanelTab) : null) : null;

  const push = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mobile) nav.push(url);
      else router.push(url, { scroll: false });
    },
    [pathname, router, mobile, nav],
  );

  const openThread = useCallback(
    (messageId: string) => {
      if (mobile) {
        nav.push(`${pathname}?thread=${messageId}`);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete("panel");
      params.delete("tab");
      params.set("thread", messageId);
      push(params);
    },
    [push, searchParams, mobile, nav, pathname],
  );

  const closeThread = useCallback(() => {
    if (mobile) {
      void nav.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("thread");
    push(params);
  }, [push, searchParams, mobile, nav]);

  const showPanel = useCallback(
    (panel: SidePanel, tab?: PanelTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("thread");
      params.set("panel", panel);
      if (tab && panel === "details") params.set("tab", tab);
      else params.delete("tab");
      // On the phone, switching tabs inside the open details screen replaces it rather than stacking.
      if (mobile && openPanel) {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return;
      }
      push(params);
    },
    [push, searchParams, mobile, openPanel, router, pathname],
  );

  const closePanel = useCallback(() => {
    if (mobile) {
      void nav.back();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("panel");
    params.delete("tab");
    push(params);
  }, [push, searchParams, mobile, nav]);

  return { openThreadId, openThread, closeThread, openPanel, panelTab, showPanel, closePanel };
}

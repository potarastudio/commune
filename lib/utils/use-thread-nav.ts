"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

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
  const openThreadId = searchParams.get("thread");
  const rawPanel = searchParams.get("panel");
  const openPanel: SidePanel | null = rawPanel === "pins" || rawPanel === "details" ? rawPanel : null;
  const rawTab = searchParams.get("tab");
  const panelTab: PanelTab | null = openPanel === "pins" ? "pins" : openPanel === "details" ? (TABS.includes(rawTab as PanelTab) ? (rawTab as PanelTab) : null) : null;

  const push = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const openThread = useCallback(
    (messageId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("panel");
      params.delete("tab");
      params.set("thread", messageId);
      push(params);
    },
    [push, searchParams],
  );

  const closeThread = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("thread");
    push(params);
  }, [push, searchParams]);

  const showPanel = useCallback(
    (panel: SidePanel, tab?: PanelTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("thread");
      params.set("panel", panel);
      if (tab && panel === "details") params.set("tab", tab);
      else params.delete("tab");
      push(params);
    },
    [push, searchParams],
  );

  const closePanel = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("panel");
    params.delete("tab");
    push(params);
  }, [push, searchParams]);

  return { openThreadId, openThread, closeThread, openPanel, panelTab, showPanel, closePanel };
}

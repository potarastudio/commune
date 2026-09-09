"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type SidePanel = "pins";

/**
 * The right-hand panel lives in the URL so links and refreshes keep it:
 * ?thread=<messageId> for a thread, ?panel=pins for pinned messages.
 * Only one is open at a time.
 */
export function useThreadNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openThreadId = searchParams.get("thread");
  const openPanel = (searchParams.get("panel") as SidePanel | null) ?? null;

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
    (panel: SidePanel) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("thread");
      params.set("panel", panel);
      push(params);
    },
    [push, searchParams],
  );

  const closePanel = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("panel");
    push(params);
  }, [push, searchParams]);

  return { openThreadId, openThread, closeThread, openPanel, showPanel, closePanel };
}

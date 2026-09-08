"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** The open thread lives in the URL (?thread=<messageId>) so links and refreshes keep it. */
export function useThreadNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openThreadId = searchParams.get("thread");

  const openThread = useCallback(
    (messageId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("thread", messageId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const closeThread = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("thread");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return { openThreadId, openThread, closeThread };
}

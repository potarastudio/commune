"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";

/**
 * The design's two connection bars (Commune Empty and Error States, isoffline
 * and isreconnecting), sitting between the channel header and the bookmarks bar
 * exactly where the design puts them.
 *
 * Offline is the browser's own signal, so it is honest without inventing a
 * heartbeat: `navigator.onLine` plus the online/offline events. Coming back
 * re-fetches the view, and the reconnecting bar stays up for as long as that
 * fetch is actually in flight — the design's "Attempt 3 of 5" is dropped rather
 * than faked, since nothing here retries on a counter.
 */
export function ConnectionBanner() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [reconnecting, startReconnect] = useTransition();

  const refresh = useCallback(() => {
    startReconnect(() => router.refresh());
  }, [router]);

  useEffect(() => {
    // navigator.onLine only exists on the client, so the first paint is always
    // "online" and this corrects it right after hydration.
    if (!navigator.onLine) setOffline(true);
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      refresh();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [refresh]);

  if (offline) {
    return (
      <div
        role="status"
        className="flex shrink-0 items-center gap-2.5 border-b border-border-strong bg-bg-chip px-5 py-[9px]"
      >
        <span
          className="grid size-5 shrink-0 place-items-center rounded-sm bg-bg-avatar text-fg-600"
          aria-hidden="true"
        >
          <BellOff className="size-3" />
        </span>
        <p className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-fg-400">
          <span className="font-semibold">You&rsquo;re offline.</span> Anything you send is queued and goes out when
          the connection is back.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="flex h-[26px] shrink-0 items-center rounded-[7px] border border-border-strong bg-bg-card px-[9px] text-[12px] font-semibold text-ink transition-colors hover:bg-bg-card-hover"
        >
          Retry now
        </button>
      </div>
    );
  }

  if (reconnecting) {
    return (
      <div
        role="status"
        className="flex shrink-0 items-center gap-2.5 border-b border-accent-surface-border bg-accent-surface px-5 py-[9px]"
      >
        <span
          aria-hidden="true"
          className="commune-spin block size-[13px] shrink-0 rounded-full border-[1.5px] border-accent-surface-border border-t-primary"
        />
        <p className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-accent-foreground">
          <span className="font-semibold">Reconnecting…</span> Your place in the conversation is kept.
        </p>
      </div>
    );
  }

  return null;
}

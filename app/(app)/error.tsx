"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The design's "load failed" main (Commune Empty and Error States, isloadFailed).
 *
 * Every server query in this segment throws on a Supabase error, so one dropped
 * connection used to render Next's stock error page — no rail, no channel
 * column, light-only. This boundary sits inside (app)/layout.tsx, so it lands in
 * the main pane with the shell intact: a 56px header, then the centred state —
 * 40px r11 chip tile, 15.5/600 line, 13/1.55 body at max-width 400, and a 32px
 * accent "Try again" that calls reset().
 *
 * (It cannot catch a throw from (app)/layout.tsx itself — that boundary would
 * have to live above the layout, outside this segment.)
 */

/** The header names where you are, the way the design's header names #design. */
const VIEWS: Record<string, { title: string; thing: string }> = {
  channel: { title: "Channel", thing: "this channel" },
  dm: { title: "Direct message", thing: "this conversation" },
  huddle: { title: "Huddle", thing: "this huddle" },
  channels: { title: "Channels", thing: "the channel list" },
  search: { title: "Search", thing: "your search" },
  activity: { title: "Activity", thing: "your activity" },
  saved: { title: "Saved", thing: "your saved messages" },
  settings: { title: "Settings", thing: "your settings" },
};
const FALLBACK = { title: "Commune", thing: "this view" };

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const view = VIEWS[pathname.split("/")[1] ?? ""] ?? FALLBACK;

  useEffect(() => {
    // The real error, with its digest, goes to the console; the reader gets plain language.
    console.error("[commune] view failed to render", { pathname, digest: error.digest, error });
  }, [error, pathname]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-main px-5">
        <span className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{view.title}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[24px] pb-[22px] pt-[18px] text-center">
        <span
          className="grid size-[40px] place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600"
          aria-hidden="true"
        >
          <Compass className="size-[17px]" />
        </span>
        <h1 className="mt-[12px] text-[15.5px] font-semibold tracking-[-0.015em] text-ink">
          Couldn&rsquo;t load {view.thing}
        </h1>
        <p className="mt-[5px] max-w-[400px] text-pretty text-[13px] leading-[1.55] text-fg-600">
          The connection dropped part-way through. Nothing was lost — it is all still there.
        </p>
        <Button size="md" className="mt-[12px] px-[13px]" onClick={reset}>
          Try again
        </Button>
      </div>
    </>
  );
}

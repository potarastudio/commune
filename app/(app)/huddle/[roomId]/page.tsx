"use client";

import { ArrowLeft, Headphones } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HuddleStageOutlet } from "@/components/huddle/huddle-stage-slot";
import { useHuddleStore } from "@/lib/store/huddle";

/**
 * Full-screen huddle view (§3). The connection lives in HuddleProvider in the
 * app shell, so this page only reads the session; opening it without one
 * (a shared link, a reload, the huddle having ended) shows the ended summary.
 *
 * With a session this renders nothing but an empty slot. The stage itself is
 * rendered by the provider and portalled in here, because it needs the live
 * room and the provider is the only thing that holds it. The outlet uses
 * `display: contents`, so the stage sits in <main> exactly as it did when this
 * page rendered it directly.
 */
export default function HuddlePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const session = useHuddleStore((s) => s.session);

  if (!session || session.huddleId !== roomId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-[380px] rounded-xl border border-border bg-bg-chip px-[14px] py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border-subtle bg-bg-card text-fg-600">
              <Headphones className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-[150px] flex-1">
              <h1 className="block text-[13px] font-semibold text-ink">Huddle ended</h1>
              <p className="mt-px block text-[12px] text-fg-600">You&apos;re not in this one. Huddles don&apos;t survive a page reload — start or join another from the channel it belongs to.</p>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/"
              className="flex h-[30px] items-center gap-1.5 rounded-md border border-border-strong bg-bg-card px-[11px] text-[12.5px] font-semibold text-ink shadow-xs transition-colors hover:bg-bg-card-hover"
            >
              <ArrowLeft className="size-3.5 text-fg-600" aria-hidden="true" />
              Back to Commune
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <HuddleStageOutlet />;
}

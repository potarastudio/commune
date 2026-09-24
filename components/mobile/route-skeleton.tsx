"use client";

import { ChevronLeft, Plus, SendHorizontal, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { rootTabOf } from "@/lib/mobile";

const DELAYS = ["", "[animation-delay:120ms]", "[animation-delay:240ms]", "[animation-delay:360ms]"];
const MESSAGE_LINES = [["w-[86%]"], ["w-[64%]", "w-[58%]"], ["w-[72%]"], ["w-[52%]", "w-[41%]"]];

/**
 * The phone's route skeleton (design: Mobile Navigation → Route loading):
 * the same stagger as the desktop's, on the phone's row geometry, so nothing
 * shifts when the content lands. A tab root gets its title bar and list rows;
 * a pushed conversation gets its back button, message rows and the composer.
 */
export function MobileRouteSkeleton() {
  const pathname = usePathname();
  const root = rootTabOf(pathname);

  if (root) {
    return (
      <>
        <header className="flex h-[56px] shrink-0 items-center border-b border-border bg-bg-main px-[16px]">
          <Skeleton className="h-[16px] w-[96px] rounded-[4px]" />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden bg-bg-main pt-[10px]" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-[12px] px-[16px] py-[11px]">
              <Skeleton className={`size-[40px] shrink-0 rounded-full ${DELAYS[i % 4]}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <Skeleton className={`h-[12px] w-[120px] rounded-[4px] ${DELAYS[i % 4]}`} />
                <Skeleton className={`h-[11px] rounded-[4px] ${DELAYS[i % 4]} ${["w-[78%]", "w-[62%]", "w-[70%]", "w-[54%]"][i % 4]}`} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center gap-[4px] border-b border-border bg-bg-main pr-[6px] pl-[2px]">
        <span className="grid size-[44px] shrink-0 place-items-center text-fg-600" aria-hidden="true">
          <ChevronLeft className="size-[20px]" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <Skeleton className="h-[14px] w-[104px] rounded-[4px]" />
          <Skeleton className="h-[11px] w-[152px] rounded-[4px]" />
        </span>
        <span className="grid size-[44px] shrink-0 place-items-center text-fg-600" aria-hidden="true">
          <Users className="size-[19px]" strokeWidth={1.75} />
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden bg-bg-main py-[10px]" aria-busy="true" aria-label="Loading">
        {MESSAGE_LINES.map((lines, i) => (
          <div key={i} className="flex gap-[10px] px-[16px] py-[7px]">
            <Skeleton className={`size-[32px] shrink-0 rounded-[9px] ${DELAYS[i]}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <div className="flex gap-[8px]">
                <Skeleton className={`h-[12px] w-[108px] rounded-[4px] ${DELAYS[i]}`} />
                <Skeleton className={`h-[12px] w-[44px] rounded-[4px] ${DELAYS[i]}`} />
              </div>
              {lines.map((w) => (
                <Skeleton key={w} className={`h-[12px] rounded-[4px] ${w} ${DELAYS[i]}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border bg-bg-main px-[8px] pt-[8px] pb-[calc(10px+var(--safe-bottom))]" aria-hidden="true">
        <div className="flex items-end gap-[6px]">
          <span className="grid size-[44px] shrink-0 place-items-center text-fg-600">
            <Plus className="size-[21px]" strokeWidth={1.75} />
          </span>
          <span className="flex min-h-[44px] min-w-0 flex-1 items-center rounded-[22px] border border-border-input bg-bg-card px-[15px] text-[14.5px] text-muted-foreground">
            Message
          </span>
          <span className="grid size-[44px] shrink-0 place-items-center rounded-full border border-border-strong bg-bg-subtle text-muted-foreground">
            <SendHorizontal className="size-[19px]" strokeWidth={1.75} />
          </span>
        </div>
      </div>
    </>
  );
}

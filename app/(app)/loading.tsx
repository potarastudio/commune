import { Skeleton } from "@/components/ui/skeleton";

/**
 * The design's skeleton main (Commune Empty and Error States, isskelMsgs), shown
 * while a view's server data is in flight. It renders inside (app)/layout.tsx,
 * so the rail and the channel column stay put and only the main pane swaps —
 * skeletons, not a spinner (§6).
 *
 * Geometry from the design: a 56px header with bars where the title, topic and
 * the header's buttons sit, then rows at 20px/24px padding — a 36px r10 avatar,
 * a 12px name bar with a 44px timestamp bar beside it, and 12px body bars, each
 * row 120ms behind the one above it.
 */
const ROWS = [
  { delay: "", lines: ["w-[86%]"] },
  { delay: "[animation-delay:120ms]", lines: ["w-[64%]", "w-[58%]"] },
  { delay: "[animation-delay:240ms]", lines: ["w-[72%]"] },
  { delay: "[animation-delay:360ms]", lines: ["w-[52%]", "w-[41%]"] },
];

export default function AppLoading() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-main px-5">
        <Skeleton className="h-[14px] w-[104px] rounded-[4px]" />
        <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <Skeleton className="h-[12px] w-[168px] rounded-[4px]" />
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <Skeleton className="h-[26px] w-[68px] rounded-full" />
          <Skeleton className="h-[32px] w-[52px] rounded-[8px]" />
          <Skeleton className="h-[32px] w-[92px] rounded-[8px]" />
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-6 py-5" aria-busy="true" aria-label="Loading">
        {ROWS.map((row, i) => (
          <div key={i} className="flex gap-3 py-[9px]">
            <Skeleton className={`size-9 shrink-0 rounded-[10px] ${row.delay}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <div className="flex gap-2">
                <Skeleton className={`h-[12px] w-[108px] rounded-[4px] ${row.delay}`} />
                <Skeleton className={`h-[12px] w-[44px] rounded-[4px] ${row.delay}`} />
              </div>
              {row.lines.map((line) => (
                <Skeleton key={line} className={`h-[12px] rounded-[4px] ${line} ${row.delay}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

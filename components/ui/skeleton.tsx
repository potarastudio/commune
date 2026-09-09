import { cn } from "@/lib/utils"

/**
 * The design fills skeletons with --bg-avatar (not --bg-subtle, which is
 * invisible against --bg-card in dark) and animates them with commune-pulse.
 * Text bars are r4, block shapes r10 — override per shape.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("commune-pulse rounded-[6px] bg-bg-avatar", className)}
      {...props}
    />
  )
}

export { Skeleton }

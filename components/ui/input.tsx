import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Field: h34 · r8 · 1px --border-input · --bg-card · shadow-xs · 13.5px · px10.
 * Focus replaces the shadow with the design's 3px accent halo. `field-focus`
 * carries the same rule for wrapper elements; the utilities below win on the
 * input itself because they sit in Tailwind's utilities layer.
 * `aria-invalid` is mirrored onto `data-invalid` because the unlayered
 * `.field-focus[data-invalid="true"]` rule is the only thing that can beat the
 * accent halo — a layered `aria-invalid:focus-visible:ring-*` utility loses to
 * it, so an invalid field would otherwise focus orange. The design draws the
 * error field with the danger border and halo at rest (Commune Login).
 * Taller steps from the scale: h-[38px] · h-[40px] · h-[44px] via className.
 */
function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  const invalid =
    props["aria-invalid"] === true || props["aria-invalid"] === "true"

  return (
    <input
      type={type}
      data-slot="input"
      data-invalid={invalid ? "true" : undefined}
      className={cn(
        "field-focus h-[34px] w-full min-w-0 rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13.5px] text-body shadow-xs",
        "transition-[color,border-color,box-shadow] selection:bg-primary selection:text-primary-foreground",
        "file:inline-flex file:h-[26px] file:border-0 file:bg-transparent file:text-[13px] file:font-semibold file:text-ink",
        "placeholder:text-muted-foreground",
        "focus-visible:border-primary focus-visible:shadow-none focus-visible:ring-[3px] focus-visible:ring-accent-surface focus-visible:outline-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:shadow-none aria-invalid:focus-visible:ring-danger-surface",
        className
      )}
      {...props}
    />
  )
}

export { Input }

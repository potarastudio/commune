import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Commune buttons — geometry lifted from the design's inline styles.
 *   filled   h34 · r8 · 1px --accent-border · --accent · 13/600 · px13 · gap7
 *   outline  h34 · r8 · 1px --border-strong · --bg-card · shadow-xs · 13/600
 *   ghost    h34 · r8 · transparent · --fg-600, hovering to --bg-subtle/--ink
 *   danger   h34 · r8 · 1px --danger · --danger · white
 * Every transparent-background button in the design is --fg-600 (227 at h30,
 * 156 at h28, 15 at h32, 13 at h44 — none at --fg-400), and all of them hover
 * to `background:var(--bg-subtle); color:var(--ink)`, the single most repeated
 * interaction in the files. Ghost therefore sets --fg-600 on the base so the
 * `hover:` utility, which carries an extra `:hover` in its selector, always
 * wins — an `[&[data-size^=icon]]` override ties on specificity and kills it.
 * Sizes are the handoff's button scale (28 · 30 · 32 · 34 · 40 · 44) and the
 * square icon scale the design actually draws (26 · 28 · 30 · 32 · 34, with
 * 30/r7 by far the most common at 239 uses). Focus is the global 2px accent
 * ring, so the base must not set `outline-none`.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold",
    "transition-[background-color,border-color,color,box-shadow,opacity,filter]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-danger",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
  ],
  {
    variants: {
      variant: {
        default:
          "border border-accent-border bg-primary text-primary-foreground shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-accent-border-hover hover:bg-primary-hover",
        destructive:
          "border border-danger bg-danger text-white shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-95",
        "destructive-outline":
          "border border-border-strong bg-bg-card text-danger shadow-xs hover:border-danger hover:bg-danger-surface",
        outline:
          "border border-border-strong bg-bg-card text-ink shadow-xs hover:border-border-hover hover:bg-bg-card-hover",
        secondary:
          "border border-border-strong bg-bg-chip text-ink hover:border-border-chip-hover hover:bg-bg-avatar",
        ghost:
          "border border-transparent bg-transparent text-fg-600 hover:bg-bg-subtle hover:text-ink",
        link: "border border-transparent bg-transparent text-ink underline decoration-link-underline underline-offset-[2.5px] hover:text-accent-text hover:decoration-accent-text",
      },
      size: {
        default: "h-[34px] gap-[7px] rounded-[8px] px-[13px] text-[13px] has-[>svg]:px-[11px]",
        xs: "h-[28px] gap-[6px] rounded-[8px] px-[9px] text-[12.5px] has-[>svg]:px-[8px] [&_svg:not([class*='size-'])]:size-[13px]",
        sm: "h-[30px] gap-[6px] rounded-[8px] px-[10px] text-[12.5px] has-[>svg]:px-[9px]",
        md: "h-[32px] gap-[7px] rounded-[8px] px-[12px] text-[13px] has-[>svg]:px-[10px]",
        lg: "h-[40px] gap-[9px] rounded-[10px] px-[15px] text-[13.5px] has-[>svg]:px-[13px]",
        xl: "h-[44px] gap-[11px] rounded-[10px] px-[16px] text-[14px] has-[>svg]:px-[14px] [&_svg:not([class*='size-'])]:size-[17px]",
        icon: "size-[30px] rounded-[7px]",
        "icon-xs": "size-[26px] rounded-[6px] [&_svg:not([class*='size-'])]:size-[13px]",
        "icon-sm": "size-[28px] rounded-[6px]",
        "icon-md": "size-[32px] rounded-[8px] [&_svg:not([class*='size-'])]:size-[16px]",
        "icon-lg": "size-[34px] rounded-[8px] [&_svg:not([class*='size-'])]:size-[17px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

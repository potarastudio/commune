"use client"

import {
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Toasts, from the design's two notification variants: a --bg-card card at r12
 * with shadow-lg, an 11px gap, a 26px icon tile (--presence for success,
 * --danger on --danger-surface for error), a 13/600 --ink title and a 12px
 * --fg-600 description. Sonner paints itself through attribute selectors that
 * out-rank plain utilities, so the design lands as `!` utilities in
 * toastOptions.classNames — every existing toast() call picks it up unchanged.
 */
const designedClassNames: NonNullable<ToasterProps["toastOptions"]>["classNames"] = {
  // The design sizes the card by its content (`width:max-content`) and only caps
  // it, which is why its two toasts are visibly different widths. Sonner pins
  // every toast to --width, so hug the content and centre it inside that band:
  // inset-x-0 + mx-auto centres an absolutely positioned box without touching
  // `transform`, which sonner owns for the enter/exit and swipe animations.
  toast:
    "inset-x-0! mx-auto! w-max! max-w-full! items-center! gap-[11px]! rounded-[12px]! border! border-border! bg-bg-card! p-[10px]! pl-[13px]! font-sans! text-ink! shadow-lg!",
  icon: "size-[26px]! shrink-0! justify-center! rounded-md! border! border-border! bg-bg-chip! text-fg-600!",
  content: "gap-[1px]!",
  title: "text-[13px]! leading-[1.35]! font-semibold! text-ink!",
  description: "text-[12px]! leading-[1.45]! font-normal! text-fg-600!",
  actionButton:
    "h-[28px]! shrink-0! rounded-md! border! border-border-strong! bg-bg-card! px-[10px]! text-[12.5px]! font-semibold! text-ink! shadow-none! hover:bg-bg-card-hover!",
  cancelButton:
    "h-[28px]! shrink-0! rounded-md! border! border-border-strong! bg-bg-card! px-[10px]! text-[12.5px]! font-semibold! text-fg-600! shadow-none! hover:bg-bg-card-hover! hover:text-ink!",
  // The design draws the dismiss inline, as the last child of the trailing
  // button group: 26px, borderless, transparent until hover, 4px after the
  // action. Sonner's own rule pins it `position:absolute; top:0` with a
  // -35%/-35% translate, hanging a bordered circle off the card's corner — so
  // unpin it (static + transform-none), send it to the end of the flex row with
  // `order`, and pull it back 7px to net the design's 4px out of the card's
  // 11px gap.
  closeButton:
    "static! order-[9]! -ml-[7px]! size-[26px]! shrink-0! transform-none! rounded-sm! border-0! bg-transparent! p-0! text-muted-foreground! transition-colors! hover:bg-bg-subtle! hover:text-ink! focus-visible:shadow-none!",
  // Only the icon tile carries the tone; the card itself stays --bg-card (decision 4:
  // danger is a colour you read, not a slab you fill).
  success: "[&_[data-icon]]:text-presence!",
  error:
    "border-danger! [&_[data-icon]]:border-danger! [&_[data-icon]]:bg-danger-surface! [&_[data-icon]]:text-danger!",
  warning: "[&_[data-icon]]:text-fg-400!",
  info: "[&_[data-icon]]:text-fg-400!",
}

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CheckIcon className="size-[14px]" />,
        info: <InfoIcon className="size-[14px]" />,
        warning: <TriangleAlertIcon className="size-[14px]" />,
        error: <CircleAlertIcon className="size-[14px]" />,
        loading: <Loader2Icon className="size-[14px] animate-spin" />,
        close: <XIcon className="size-[13px]" />,
      }}
      style={
        {
          // The band the toasts are centred in — and, with `w-max`, their cap.
          "--width": "380px",
          "--normal-bg": "var(--bg-card)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--border)",
          "--normal-bg-hover": "var(--bg-card-hover)",
          "--normal-border-hover": "var(--border-hover)",
          // Providers keeps richColors off (it would fill the card green/red);
          // these keep it on-palette if it is ever switched on.
          "--success-bg": "var(--bg-card)",
          "--success-border": "var(--border)",
          "--success-text": "var(--ink)",
          "--info-bg": "var(--bg-card)",
          "--info-border": "var(--border)",
          "--info-text": "var(--ink)",
          "--warning-bg": "var(--bg-card)",
          "--warning-border": "var(--border)",
          "--warning-text": "var(--ink)",
          "--error-bg": "var(--bg-card)",
          "--error-border": "var(--danger)",
          "--error-text": "var(--ink)",
          "--border-radius": "12px",
          "--toast-icon-margin-start": "0px",
          "--toast-icon-margin-end": "0px",
          "--toast-svg-margin-start": "0px",
          "--toast-svg-margin-end": "0px",
          // The design's trailing group sits 6px past the card's 11px gap.
          "--toast-button-margin-start": "6px",
          "--toast-button-margin-end": "0px",
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: { ...designedClassNames, ...toastOptions?.classNames },
      }}
      {...props}
    />
  )
}

export { Toaster }

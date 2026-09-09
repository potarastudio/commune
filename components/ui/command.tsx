"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "@/lib/utils"
import { SearchIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Quick switcher, from the design's palette states: a 520px modal whose query
 * row is a 17px --muted glyph beside 15px --body text over a --border-subtle
 * hairline, ending in an `esc` keycap. Result rows are full-bleed (the design
 * does not inset them), 34px tall at 13.5/500 --ink, and the selected row is
 * --bg-subtle. Group headings are the 11/700/0.06em caps overline, and the
 * shell ends in a hint bar on --bg-col. The palette has no close button — the
 * `esc` cap and the hint bar are the affordance — so `CommandDialog` defaults
 * `showCloseButton` off, where the dialog's absolutely positioned X would
 * otherwise land on top of the query row.
 */
function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[12px] bg-popover text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn("overflow-hidden p-0 sm:max-w-[520px]", className)}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="min-h-0 flex-1 rounded-none bg-transparent">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  trailing,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  trailing?: React.ReactNode
}) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex shrink-0 items-center gap-[10px] border-b border-border-subtle px-[16px] py-[14px]"
    >
      <SearchIcon className="size-[17px] shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-[21px] w-full min-w-0 bg-transparent text-[15px] text-body outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[360px] scroll-py-1 overflow-x-hidden overflow-y-auto pb-[8px]",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn(
        "px-[22px] pt-[26px] pb-[24px] text-center text-[14px] font-semibold text-ink",
        className
      )}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-ink",
        "[&_[cmdk-group-heading]]:px-[14px] [&_[cmdk-group-heading]]:pt-[10px] [&_[cmdk-group-heading]]:pb-[4px]",
        "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("my-[4px] h-px bg-border-subtle", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-[34px] cursor-default items-center gap-[11px] px-[14px] py-[9px]",
        "text-[13.5px] font-medium text-ink outline-hidden select-none",
        "data-[selected=true]:bg-bg-subtle data-[selected=true]:text-ink",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] [&_svg:not([class*='text-'])]:text-fg-600",
        className
      )}
      {...props}
    />
  )
}

/** The design's keycap: 20px, r5, 1px --border-strong on --bg-subtle. */
function CommandKbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="command-kbd"
      className={cn(
        "inline-grid h-[20px] min-w-[20px] place-items-center rounded-[5px] border border-border-strong bg-bg-subtle px-[5px] font-sans text-[11px] font-semibold text-fg-400",
        className
      )}
      {...props}
    />
  )
}

/** Hint bar closing the palette: --bg-col behind a --border-subtle hairline. */
function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-footer"
      className={cn(
        "flex shrink-0 items-center gap-[8px] border-t border-border-subtle bg-bg-col px-[14px] py-[9px] text-[11.5px] text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto shrink-0 text-[11.5px] font-normal text-muted-foreground tabular-nums",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandItem,
  CommandKbd,
  CommandShortcut,
  CommandSeparator,
}

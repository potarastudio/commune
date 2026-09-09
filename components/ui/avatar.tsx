"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"

/**
 * Avatars are ROUND everywhere except the message row: across the design
 * files every 22/26/32/34/46/64px avatar is border-radius:9999px, and only
 * the 36px message avatar (r10) and the 56px profile-card avatar (r14) are
 * rounded squares. Each sits on --bg-avatar with an inset --avatar-ring
 * hairline so it reads on any ground.
 * Sizes follow the handoff scale: 22 · 26 · 32 · 36 · 46 · 56 · 64.
 */
function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "xs" | "sm" | "default" | "lg" | "xl" | "2xl" | "3xl"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-[32px] shrink-0 overflow-hidden rounded-full bg-bg-avatar select-none",
        "shadow-[inset_0_0_0_1px_var(--avatar-ring)]",
        "data-[size=xs]:size-[22px]",
        "data-[size=sm]:size-[26px]",
        // The message row is the one rounded square in the design.
        "data-[size=lg]:size-[36px] data-[size=lg]:rounded-[10px]",
        "data-[size=xl]:size-[46px]",
        "data-[size=2xl]:size-[56px] data-[size=2xl]:rounded-[14px]",
        "data-[size=3xl]:size-[64px]",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-[inherit] object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] bg-bg-avatar text-[12.5px] font-semibold text-fg-600",
        "group-data-[size=xs]/avatar:text-[9.5px] group-data-[size=sm]/avatar:text-[10.5px]",
        "group-data-[size=xl]/avatar:text-[16px] group-data-[size=2xl]/avatar:text-[19px]",
        "group-data-[size=3xl]/avatar:text-[22px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Presence / status dot. The design draws a 7–10px round dot cut out of the
 * avatar in --presence, with a 2px ring in whatever surface it sits on — pass
 * `ring-rail`, `ring-bg-col` or `ring-bg-card` where the ground is not
 * --bg-main. The accent is reserved for mentions, so it is never the default
 * here; pass `bg-primary` explicitly for a badge that is not presence.
 */
function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-presence text-white ring-2 ring-bg-main select-none",
        "size-[9px] [&>svg]:size-[7px]",
        "group-data-[size=xs]/avatar:size-[7px] group-data-[size=xs]/avatar:[&>svg]:hidden",
        "group-data-[size=sm]/avatar:size-[8px] group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=lg]/avatar:size-[10px] group-data-[size=xl]/avatar:size-[12px]",
        "group-data-[size=2xl]/avatar:size-[13px] group-data-[size=3xl]/avatar:size-[14px]",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-[6px] *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-bg-main",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-[32px] shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-groupdm text-[10.5px] font-semibold text-fg-600 ring-2 ring-bg-main tabular-nums",
        "group-has-data-[size=xs]/avatar-group:size-[22px]",
        "group-has-data-[size=sm]/avatar-group:size-[26px]",
        "group-has-data-[size=lg]/avatar-group:size-[36px] group-has-data-[size=lg]/avatar-group:rounded-[10px]",
        "group-has-data-[size=xl]/avatar-group:size-[46px] group-has-data-[size=xl]/avatar-group:text-[12.5px]",
        "[&>svg]:size-[13px]",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
}

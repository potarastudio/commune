"use client";

import { Keyboard, LogOut, Settings, SmilePlus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { signOut } from "@/app/(app)/actions";
import { StatusEditor } from "@/components/profile/status-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Profile } from "@/lib/queries/profile";
import { useProfileMap } from "@/lib/queries/profiles";
import { useUiStore } from "@/lib/store/ui";
import { isStatusActive } from "@/lib/utils/status";

/** Account button at the foot of the rail; the menu itself is unchanged. */
export function UserMenu({ profile: initial }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const profile = useProfileMap().get(initial.id) ?? initial;
  const status = isStatusActive(profile);

  return (
    <Popover open={statusOpen} onOpenChange={setStatusOpen}>
    <PopoverAnchor asChild>
    <div ref={anchorRef}>
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Account menu" className="relative block size-[32px] shrink-0 rounded-full">
              <Avatar className="size-[32px] rounded-full bg-primary ring-[1.5px] ring-white/[0.16]">
                <AvatarImage src={profile.avatar_url ?? undefined} alt="" className="object-cover" />
                <AvatarFallback className="rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -right-px -bottom-px size-[10px] rounded-full border-2 border-rail bg-presence" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{profile.display_name}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-[13.5px] font-semibold text-ink">{profile.display_name}</span>
          <span className="block truncate text-[12px] text-muted-foreground">@{profile.handle}</span>
          {/* Which Google account you are signed in as — the one thing the trigger can't show. */}
          <span className="block truncate text-[11.5px] text-tertiary">{profile.email}</span>
          {status && (
            <span className="mt-[2px] block truncate text-[12px] text-fg-600">
              {profile.status_emoji && (
                <span role="img" aria-hidden="true" className="mr-1">
                  {profile.status_emoji}
                </span>
              )}
              {profile.status_text ?? "Status set"}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Open after the menu has closed, so its dismiss events don't count as a click outside the editor. */}
        <DropdownMenuItem onSelect={() => setTimeout(() => setStatusOpen(true), 60)}>
          {status && profile.status_emoji ? (
            <span role="img" aria-hidden="true" className="w-4 text-center text-[14px] leading-none">
              {profile.status_emoji}
            </span>
          ) : (
            <SmilePlus className="size-4" aria-hidden="true" />
          )}
          {status ? "Edit your status" : "Set a status"}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" aria-hidden="true" />
            Profile settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useUiStore.getState().setShortcutsOpen(true)}>
          <Keyboard className="size-4" aria-hidden="true" />
          Keyboard shortcuts
          <span className="ml-auto text-[11px] text-muted-foreground">⌘/</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => startTransition(() => signOut())}>
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
    </PopoverAnchor>
    <PopoverContent
      side="right"
      align="end"
      sideOffset={10}
      className="w-auto p-0"
      // The closing menu shuffles focus around (its own wrapper, then the account button); none of that
      // should dismiss the editor. Clicking elsewhere, Esc and the X still close it.
      onFocusOutside={(e) => e.preventDefault()}
      onInteractOutside={(e) => anchorRef.current?.contains(e.target as Node) && e.preventDefault()}
    >
      {statusOpen && <StatusEditor profile={profile} onDone={() => setStatusOpen(false)} />}
    </PopoverContent>
    </Popover>
  );
}

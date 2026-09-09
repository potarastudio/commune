"use client";

import { ChevronsUpDown, Keyboard, LogOut, Settings, SmilePlus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { signOut } from "@/app/(app)/actions";
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
import { StatusEditor } from "@/components/profile/status-editor";
import type { Profile } from "@/lib/queries/profile";
import { useProfileMap } from "@/lib/queries/profiles";
import { isStatusActive } from "@/lib/utils/status";
import { useUiStore } from "@/lib/store/ui";

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
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <span className="relative">
            <Avatar className="size-8 rounded-md">
              <AvatarImage src={profile.avatar_url ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="rounded-md bg-primary text-[12px] font-semibold text-primary-foreground">
                {profile.display_name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar bg-online" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium">{profile.display_name}</span>
            <span className="block truncate text-[12px] text-sidebar-muted">
              {status ? (
                <>
                  {profile.status_emoji && (
                    <span role="img" aria-hidden="true" className="mr-1">
                      {profile.status_emoji}
                    </span>
                  )}
                  {profile.status_text ?? "Status set"}
                </>
              ) : (
                <>@{profile.handle}</>
              )}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-sidebar-muted" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[13px] font-medium">{profile.display_name}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{profile.email}</span>
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
      side="top"
      align="start"
      sideOffset={8}
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

"use client";

import { ChevronsUpDown, Keyboard, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
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
import type { Profile } from "@/lib/queries/profile";
import { useUiStore } from "@/lib/store/ui";

export function UserMenu({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();

  return (
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
            <span className="block truncate text-[12px] text-sidebar-muted">@{profile.handle}</span>
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
  );
}

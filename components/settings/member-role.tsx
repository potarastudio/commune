"use client";

import { ChevronDown, ShieldCheck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setRoleAction } from "@/lib/actions/admin";

/** Admin-only role switch for one member. The server refuses to demote the last admin. */
export function MemberRole({ userId, role, name, isMe }: { userId: string; role: string; name: string; isMe: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isAdmin = role === "admin";

  const change = (next: "admin" | "member") =>
    startTransition(async () => {
      const result = await setRoleAction({ userId, role: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(next === "admin" ? `${name} is now an admin` : `${name} is now a member`);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label={`Change ${name}'s role, currently ${isAdmin ? "admin" : "member"}`}
          className="flex h-[34px] shrink-0 items-center gap-2 rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13px] font-medium text-ink shadow-xs transition-colors hover:border-border-hover hover:bg-bg-card-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? "Saving…" : isAdmin ? "Admin" : "Member"}
          <ChevronDown className="size-[13px] text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[248px]">
        <DropdownMenuItem disabled={isAdmin} onSelect={() => change("admin")}>
          <ShieldCheck aria-hidden="true" />
          <span className="flex-1">Make admin</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!isAdmin} onSelect={() => change("member")}>
          <User aria-hidden="true" />
          <span className="flex-1">{isMe ? "Step down to member" : "Make member"}</span>
        </DropdownMenuItem>
        <p className="px-2 pb-[6px] pt-[6px] text-[12px] leading-[1.45] text-fg-600">
          Admins invite people, archive channels and can delete any message.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

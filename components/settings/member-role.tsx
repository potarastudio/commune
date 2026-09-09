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
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {isAdmin && <ShieldCheck className="size-3.5" aria-hidden="true" />}
          {pending ? "Saving…" : isAdmin ? "Admin" : "Member"}
          <ChevronDown className="size-3" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={isAdmin} onSelect={() => change("admin")}>
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span className="flex-1">Make admin</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!isAdmin} onSelect={() => change("member")}>
          <User className="size-4" aria-hidden="true" />
          <span className="flex-1">{isMe ? "Step down to member" : "Make member"}</span>
        </DropdownMenuItem>
        <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-muted-foreground">Admins invite people, archive channels and can delete any message.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

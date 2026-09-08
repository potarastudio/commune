import { LogOut } from "lucide-react";
import { signOut } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            className="size-8 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Sign out</TooltipContent>
      </Tooltip>
    </form>
  );
}

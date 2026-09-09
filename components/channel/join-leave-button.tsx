"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinChannelAction, leaveChannelAction } from "@/lib/actions/channels";

export function JoinLeaveButton({
  channelId,
  channelName,
  joined,
  size = "sm",
  afterLeaveHref,
  className = "",
}: {
  channelId: string;
  channelName: string;
  joined: boolean;
  size?: "sm" | "default";
  /** Where to go after leaving (e.g. away from the channel you just left). */
  afterLeaveHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isGeneral = channelName === "general";

  const act = () => {
    startTransition(async () => {
      const result = joined ? await leaveChannelAction({ channelId }) : await joinChannelAction({ channelId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(joined ? `You left #${channelName}` : `You joined #${channelName}`);
      if (joined && afterLeaveHref) router.push(afterLeaveHref);
      else router.refresh();
    });
  };

  if (joined && isGeneral) {
    return (
      <span className="text-[12px] text-muted-foreground" title="Everyone stays in #general">
        Everyone is here
      </span>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      /* Leaving is destructive: red as text on the card surface, never as a
         fill — the design's "Leave channel" button (§ design decision 4). */
      variant={joined ? "destructive-outline" : "default"}
      disabled={pending}
      onClick={act}
      className={className}
    >
      {pending ? (joined ? "Leaving…" : "Joining…") : joined ? "Leave" : "Join"}
    </Button>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Info, Lock, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { leaveChannelAction, setNotificationLevelAction } from "@/lib/actions/channels";
import { markReadAction } from "@/lib/actions/messages";
import type { JoinedChannel } from "@/lib/queries/channels";
import { clearUnread } from "@/lib/queries/unreads";
import { Sheet, SheetAction } from "./sheet";
import { useMobileNav } from "./use-mobile-nav";

/**
 * Long-press on a channel (design: Mobile Touch → Long-press a row): the row
 * lifts, the sheet lists what you can do with it, and the only step you cannot
 * simply undo — leaving — sits last and red, and asks twice.
 */
export function ChannelSheet({
  channel,
  open,
  onOpenChange,
}: {
  channel: JoinedChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const nav = useMobileNav();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const muted = channel.notification_level === "muted";
  const general = channel.name === "general";
  const container = { kind: "channel" as const, id: channel.id };

  const close = () => {
    setConfirmLeave(false);
    onOpenChange(false);
  };

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        toast.error(result.error ?? "That didn't go through.");
        return;
      }
      toast.success(done);
      close();
      router.refresh();
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmLeave(false);
        onOpenChange(next);
      }}
      title={`#${channel.name}`}
      above={
        <div className="flex items-center gap-[11px] rounded-[14px] border border-border bg-bg-card px-[14px] py-[11px] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.45)]">
          <span className="grid size-[32px] shrink-0 place-items-center rounded-[9px] border border-border-subtle bg-bg-chip text-[14px] font-semibold text-primary">
            {channel.is_private ? <Lock className="size-[14px]" strokeWidth={2} aria-hidden="true" /> : "#"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold text-ink">{channel.name}</span>
            <span className="mt-px block truncate text-[12px] text-muted-foreground">
              {channel.topic || (channel.is_private ? "Private channel" : "Public channel")}
            </span>
          </span>
        </div>
      }
    >
      <div className="min-h-0 overflow-y-auto">
        <SheetAction
          icon={<CheckCheck />}
          disabled={pending}
          onSelect={() => {
            clearUnread(queryClient, container);
            close();
            void markReadAction({ container });
          }}
        >
          Mark as read
        </SheetAction>
        <SheetAction
          icon={muted ? <Bell /> : <BellOff />}
          disabled={pending}
          onSelect={() =>
            run(
              () => setNotificationLevelAction({ channelId: channel.id, level: muted ? "all" : "muted" }),
              muted ? `#${channel.name} is unmuted` : `#${channel.name} is muted`,
            )
          }
        >
          <span className="flex items-center gap-[10px]">
            <span className="min-w-0 flex-1">{muted ? "Unmute channel" : "Mute channel"}</span>
            {!muted && <span className="shrink-0 text-[13px] font-normal text-muted-foreground">Until you turn it back on</span>}
          </span>
        </SheetAction>
        <SheetAction
          icon={<Info />}
          onSelect={() => {
            close();
            nav.push(`/channel/${channel.id}?panel=details&tab=about`);
          }}
        >
          Channel details
        </SheetAction>
        {!general && (
          <SheetAction
            icon={<LogOut />}
            tone="danger"
            disabled={pending}
            onSelect={() => {
              if (!confirmLeave) {
                setConfirmLeave(true);
                return;
              }
              run(() => leaveChannelAction({ channelId: channel.id }), `You left #${channel.name}`);
            }}
          >
            {confirmLeave ? (channel.is_private ? "Tap again — you'll need an invite back" : "Tap again to leave") : "Leave channel"}
          </SheetAction>
        )}
      </div>
    </Sheet>
  );
}

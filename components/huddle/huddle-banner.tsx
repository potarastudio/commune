"use client";

import { Headphones } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActiveHuddle } from "@/lib/queries/huddles";
import type { Container } from "@/lib/queries/messages";
import { useActiveHuddle } from "@/lib/queries/use-huddle";
import { useHuddleStore } from "@/lib/store/huddle";
import { enterHuddle } from "./huddle-provider";

type Props = { container: Container; label: string; href: string; initial: ActiveHuddle | null; meId: string };

/** Header button: start a huddle here, or join the one that's running. */
export function HuddleButton({ container, label, href, initial, meId }: Props) {
  const huddle = useActiveHuddle(container, initial);
  const session = useHuddleStore((s) => s.session);
  const connecting = useHuddleStore((s) => s.connecting);
  const [busy, setBusy] = useState(false);
  const inThisOne = session?.huddleId === huddle?.id && Boolean(session);
  const someoneElseIn = huddle ? huddle.participants.some((p) => p.id !== meId) : false;

  const act = async () => {
    setBusy(true);
    await enterHuddle({ container, label, href, huddleId: huddle?.id });
    setBusy(false);
  };

  if (inThisOne) {
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-accent px-2 py-1 text-[12px] font-medium text-accent-foreground">
        <Headphones className="size-3.5" aria-hidden="true" /> In huddle
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="sm" variant={huddle ? "default" : "outline"} className="h-7 gap-1.5 px-2.5 text-[12px]" disabled={busy || connecting} onClick={() => void act()}>
          <Headphones className="size-3.5" aria-hidden="true" />
          {busy || connecting ? "Joining…" : huddle ? (someoneElseIn ? "Join huddle" : "Rejoin") : "Huddle"}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{huddle ? "A huddle is running here" : `Start a huddle in ${label}`}</TooltipContent>
    </Tooltip>
  );
}

/** "Hakim started a huddle · 3 people" with avatars and Join, under the header (§5). */
export function HuddleBanner({ container, label, href, initial, meId }: Props) {
  const huddle = useActiveHuddle(container, initial);
  const session = useHuddleStore((s) => s.session);
  const connecting = useHuddleStore((s) => s.connecting);
  const [busy, setBusy] = useState(false);
  if (!huddle || session?.huddleId === huddle.id) return null;

  const count = huddle.participants.length;
  const starter = huddle.starter?.id === meId ? "You" : (huddle.starter?.display_name ?? "Someone");

  return (
    <div className="flex items-center gap-3 border-b border-border bg-accent/60 px-5 py-2 text-[13px]" role="status">
      <Headphones className="size-4 text-accent-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{starter} started a huddle</span>
        <span className="text-muted-foreground">
          {" "}
          · {count} {count === 1 ? "person" : "people"}
        </span>
      </span>
      <span className="flex -space-x-1.5">
        {huddle.participants.slice(0, 5).map((p) => (
          <Avatar key={p.id} className="size-6 rounded-full ring-2 ring-background">
            <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
            <AvatarFallback className="rounded-full bg-background text-[10px] font-semibold">{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        ))}
      </span>
      <Button
        type="button"
        size="sm"
        className="h-7 px-3 text-[12px]"
        disabled={busy || connecting}
        onClick={async () => {
          setBusy(true);
          await enterHuddle({ container, label, href, huddleId: huddle.id });
          setBusy(false);
        }}
      >
        {busy || connecting ? "Joining…" : "Join"}
      </Button>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ProfileCardContent = dynamic(() => import("./profile-card-content").then((m) => m.ProfileCardContent), {
  ssr: false,
  loading: () => <p className="px-[16px] py-[13px] text-[12.5px] text-fg-600">Loading…</p>,
});

const OPEN_DELAY = 350;
const CLOSE_DELAY = 200;

/**
 * Hover (or click / Enter) on a name, avatar or @mention opens a small card
 * (§5 Phase 3). The trigger stays whatever element is passed in, so it keeps
 * its own styling and keyboard path; the card's data loads on open.
 *
 * The design's overlay states draw it as a 300px card with a --bg-chip
 * banner the avatar hangs off, so the surface is flush and the body owns its
 * own padding.
 */
export function ProfileCard({
  userId,
  children,
  side = "bottom",
  align = "start",
}: {
  userId: string;
  children: React.ReactElement;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const schedule = useCallback((next: boolean, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  }, []);
  useEffect(() => clear, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onPointerEnter={(e) => e.pointerType === "mouse" && schedule(true, OPEN_DELAY)}
        onPointerLeave={(e) => e.pointerType === "mouse" && schedule(false, CLOSE_DELAY)}
        onClick={clear}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-[300px] overflow-hidden p-0"
        onPointerEnter={clear}
        onPointerLeave={() => schedule(false, CLOSE_DELAY)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {open && <ProfileCardContent userId={userId} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

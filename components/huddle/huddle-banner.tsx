"use client";

import { Headphones } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActiveHuddle } from "@/lib/queries/huddles";
import type { Container } from "@/lib/queries/messages";
import { useActiveHuddle } from "@/lib/queries/use-huddle";
import { useHuddleStore } from "@/lib/store/huddle";
import { useIsMobile } from "@/lib/mobile-context";
import { cn } from "@/lib/utils";
import { enterHuddle } from "./huddle-provider";
import { useMobileNav } from "@/components/mobile/use-mobile-nav";

type Props = { container: Container; label: string; href: string; initial: ActiveHuddle | null; meId: string };

/** The accent-filled action in the view header (§6): 32px, 13/600, 15px icon. */
const ACCENT_BUTTON =
  "flex h-8 shrink-0 items-center gap-[7px] rounded-md border border-accent-border bg-primary px-3 text-[13px] font-semibold text-white shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:border-accent-border-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";

/**
 * "Running for N minutes" for the banner. Starts empty so the server render and
 * the first client paint agree, then ticks.
 */
function useRunningFor(startedAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!startedAt) {
      setLabel(null);
      return;
    }
    const tick = () => {
      const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000));
      setLabel(mins < 1 ? "Just started" : `Running ${mins} minute${mins === 1 ? "" : "s"}`);
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return label;
}

/** Header button: start a huddle here, or join the one that's running. */
export function HuddleButton({ container, label, href, initial, meId }: Props) {
  const mobile = useIsMobile();
  const huddle = useActiveHuddle(container, initial);
  const session = useHuddleStore((s) => s.session);
  const connecting = useHuddleStore((s) => s.connecting);
  const [busy, setBusy] = useState(false);
  const inThisOne = session?.huddleId === huddle?.id && Boolean(session);
  const someoneElseIn = huddle ? huddle.participants.some((p) => p.id !== meId) : false;
  const nav = useMobileNav();

  const act = async () => {
    setBusy(true);
    const ok = await enterHuddle({ container, label, href, huddleId: huddle?.id });
    setBusy(false);
    // On the phone the huddle is a screen of its own; open it once you are in.
    const id = useHuddleStore.getState().session?.huddleId;
    if (mobile && ok && id) nav.push(`/huddle/${id}`);
  };

  // The phone's header has room for icons only: a 44px headphones button, accent while a huddle is running.
  if (mobile) {
    return (
      <button
        type="button"
        aria-label={inThisOne ? "In this huddle" : huddle ? (someoneElseIn ? "Join huddle" : "Rejoin huddle") : "Start huddle"}
        disabled={busy || connecting}
        onClick={() => (inThisOne && session ? nav.push(`/huddle/${session.huddleId}`) : void act())}
        className={cn(
          "relative grid size-[44px] shrink-0 place-items-center rounded-[10px] active:bg-bg-subtle disabled:opacity-100",
          huddle ? "text-primary" : "text-fg-600",
        )}
      >
        <Headphones className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
        {(inThisOne || huddle) && (
          <span
            aria-hidden="true"
            className={cn("absolute top-[10px] right-[9px] size-[8px] rounded-full border-2 border-bg-main", inThisOne ? "bg-presence" : "bg-primary")}
          />
        )}
      </button>
    );
  }

  if (inThisOne) {
    return (
      <span className="flex h-8 shrink-0 items-center gap-[7px] rounded-md border border-accent-surface-border bg-accent-surface px-3 text-[13px] font-semibold text-accent-foreground">
        <span className="block size-[7px] shrink-0 rounded-full bg-presence" aria-hidden="true" />
        In huddle
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={ACCENT_BUTTON} disabled={busy || connecting} onClick={() => void act()}>
          <Headphones className="size-[15px]" aria-hidden="true" />
          {busy || connecting ? "Joining…" : huddle ? (someoneElseIn ? "Join huddle" : "Rejoin") : "Huddle"}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{huddle ? "A huddle is running here" : `Start a huddle in ${label}`}</TooltipContent>
    </Tooltip>
  );
}

/** "Sari started a huddle" with participant avatars and Join, under the header (§5). */
export function HuddleBanner({ container, label, href, initial, meId }: Props) {
  const mobile = useIsMobile();
  const huddle = useActiveHuddle(container, initial);
  const session = useHuddleStore((s) => s.session);
  const connecting = useHuddleStore((s) => s.connecting);
  const [busy, setBusy] = useState(false);
  const running = useRunningFor(huddle?.started_at ?? null);
  const nav = useMobileNav();
  if (!huddle || session?.huddleId === huddle.id) return null;

  const count = huddle.participants.length;
  const starter = huddle.starter?.id === meId ? "You" : (huddle.starter?.display_name ?? "Someone");
  const people = `${count} ${count === 1 ? "person" : "people"}`;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-3 border-b border-accent-surface-border bg-accent-surface py-[11px]",
        mobile ? "px-[16px]" : "px-5",
      )}
      role="status"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-accent-surface-border bg-bg-card text-accent-foreground">
        <Headphones className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-[140px] flex-1">
        <span className="block truncate text-[13px] font-semibold text-accent-foreground">{starter} started a huddle</span>
        <span className="mt-px block truncate text-[12px] text-accent-foreground">{running ? `${running} · ${people}` : people}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span className="flex">
          {huddle.participants.slice(0, 5).map((p, i) => (
            <span key={p.id} className={`block rounded-full shadow-[0_0_0_2px_var(--accent-surface)] ${i > 0 ? "-ml-[7px]" : ""}`}>
              <Avatar className="size-[26px] rounded-full bg-bg-avatar">
                <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                <AvatarFallback className="rounded-full bg-bg-avatar text-[11px] font-semibold text-fg-600">{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </span>
          ))}
        </span>
        <button
          type="button"
          className={cn(ACCENT_BUTTON, mobile && "h-[40px] rounded-[10px] px-[14px]")}
          disabled={busy || connecting}
          onClick={async () => {
            setBusy(true);
            const ok = await enterHuddle({ container, label, href, huddleId: huddle.id });
            setBusy(false);
            if (mobile && ok) nav.push(`/huddle/${huddle.id}`);
          }}
        >
          <Headphones className="size-[15px]" aria-hidden="true" />
          {busy || connecting ? "Joining…" : "Join"}
        </button>
      </span>
    </div>
  );
}

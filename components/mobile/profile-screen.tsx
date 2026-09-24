"use client";

import { Clock, Headphones, Lock, Mail, MessageSquareText, Pencil, Search, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { enterHuddle } from "@/components/huddle/huddle-provider";
import { startConversationAction } from "@/lib/actions/conversations";
import type { Profile } from "@/lib/queries/profile";
import { useHuddleStore } from "@/lib/store/huddle";
import { usePresenceStore } from "@/lib/store/presence";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { zoneDifference } from "@/lib/utils/list-time";
import { describeExpiry, isStatusActive } from "@/lib/utils/status";
import { MobileLink } from "./mobile-link";
import { PushedHeader } from "./screen-header";
import { useMobileNav } from "./use-mobile-nav";
import { primaryButtonClass, RoundFace, secondaryButtonClass } from "./ui";

type SharedChannel = { id: string; name: string; is_private: boolean };

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[12px] border-t border-border-subtle px-[16px] py-[12px] [&>svg]:size-[16px] [&>svg]:shrink-0 [&>svg]:text-tertiary">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold tracking-[0.03em] text-muted-foreground uppercase">{label}</span>
        <span className="mt-[2px] block truncate text-[14px] text-body">{children}</span>
      </span>
    </div>
  );
}

/**
 * Someone's profile on the phone (design: Mobile Core Screens → Profile) —
 * the screen "View profile" finally lands on. Message and Huddle are the two
 * things you came for; then when it is for them, how to reach them, and the
 * channels you share.
 */
export function ProfileScreen({
  person,
  meId,
  viewerTimezone,
  since,
  shared,
}: {
  person: Profile;
  meId: string;
  viewerTimezone: string;
  since: string;
  shared: SharedChannel[];
}) {
  const nav = useMobileNav();
  const hydrated = useHydrated();
  const online = usePresenceStore((s) => s.online.has(person.id));
  const [pending, startTransition] = useTransition();
  const [calling, setCalling] = useState(false);
  const isMe = person.id === meId;
  const status = hydrated && isStatusActive(person) ? person : null;
  const until = status ? describeExpiry(status.status_expires_at, person.timezone) : null;

  // Their clock is worked out from the moment, so draw it after hydration.
  const clock = hydrated
    ? new Intl.DateTimeFormat("en-GB", { timeZone: person.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())
    : null;
  const offset = hydrated ? zoneDifference(person.timezone, viewerTimezone) : null;

  const openDm = () =>
    startTransition(async () => {
      const result = await startConversationAction({ userIds: [person.id] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      nav.push(`/dm/${result.id}`);
    });

  // A huddle lives in your DM with them; start it there and open the huddle screen.
  const huddle = () =>
    startTransition(async () => {
      setCalling(true);
      try {
        const result = await startConversationAction({ userIds: [person.id] });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const ok = await enterHuddle({
          container: { kind: "conversation", id: result.id },
          label: person.display_name,
          href: `/dm/${result.id}`,
        });
        const id = useHuddleStore.getState().session?.huddleId;
        if (ok && id) nav.push(`/huddle/${id}`);
      } finally {
        setCalling(false);
      }
    });

  return (
    <>
      <PushedHeader title="Profile" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg-main pb-[calc(20px+var(--safe-bottom))]">
        <div className="flex flex-col items-center px-[20px] pt-[24px] pb-[18px] text-center">
          <span className="relative block size-[88px]">
            <RoundFace person={person} size={88} />
            {online && <span aria-hidden="true" className="absolute right-[3px] bottom-[3px] size-[18px] rounded-full border-[3px] border-bg-main bg-presence" />}
          </span>
          <h1 className="mt-[14px] text-[21px] font-semibold tracking-[-0.025em] text-ink">{person.display_name}</h1>
          <p className="mt-[3px] text-[13.5px] text-fg-600">
            {[person.title, `@${person.handle}`, person.role === "admin" ? "Admin" : null].filter(Boolean).join(" · ")}
          </p>
          {status && (status.status_text || status.status_emoji) && (
            <p className="mt-[11px] flex max-w-full items-center gap-[7px] rounded-[9px] border border-border-strong bg-bg-chip px-[11px] py-[6px] text-[13px] text-body">
              {status.status_emoji && (
                <span className="text-[14px] leading-none" aria-hidden="true">
                  {status.status_emoji}
                </span>
              )}
              <span className="min-w-0 truncate">{status.status_text}</span>
              {until && <span className="shrink-0 text-muted-foreground">· {until}</span>}
            </p>
          )}
        </div>

        <div className="flex gap-[8px] px-[16px] pb-[18px]">
          {isMe ? (
            <>
              <MobileLink href="/settings?section=profile" className={primaryButtonClass("min-w-0 flex-1 rounded-[11px]")}>
                <Pencil aria-hidden="true" />
                Edit profile
              </MobileLink>
              <MobileLink href={`/search?q=${encodeURIComponent(`from:@${person.handle}`)}`} className={secondaryButtonClass("min-w-0 flex-1 rounded-[11px]")}>
                <Search aria-hidden="true" />
                Your messages
              </MobileLink>
            </>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => openDm()} className={primaryButtonClass("min-w-0 flex-1 rounded-[11px]")}>
                <MessageSquareText aria-hidden="true" />
                {pending && !calling ? "Opening…" : "Message"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={huddle}
                className={secondaryButtonClass("min-w-0 flex-1 rounded-[11px]")}
              >
                <Headphones aria-hidden="true" />
                {calling ? "Calling…" : "Huddle"}
              </button>
            </>
          )}
        </div>

        <section className="mx-[16px] overflow-hidden rounded-[12px] border border-border bg-bg-card">
          <h2 className="px-[16px] pt-[11px] pb-[9px] text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Details</h2>
          <Detail icon={<Clock />} label="Local time">
            {clock ? (isMe ? clock : `${clock} · ${offset ?? ""}`.replace(/ · $/, "")) : " "}
          </Detail>
          <Detail icon={<Mail />} label="Email">
            <a href={`mailto:${person.email}`} className="text-body">
              {person.email}
            </a>
          </Detail>
          <Detail icon={<Users />} label="In the studio since">
            {since}
          </Detail>
        </section>

        <h2 className="px-[16px] pt-[20px] pb-[6px] text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          {isMe ? "Your channels" : shared.length === 1 ? "1 channel in common" : `${shared.length} channels in common`}
        </h2>
        {shared.length === 0 ? (
          <p className="px-[16px] text-[13.5px] leading-[1.55] text-fg-600">
            {isMe ? "You are not in any channels yet." : `You and ${person.display_name.split(" ")[0]} are not in any of the same channels yet.`}
          </p>
        ) : (
          <div className="flex flex-wrap gap-[7px] px-[16px]">
            {shared.map((c) => (
              <MobileLink
                key={c.id}
                href={`/channel/${c.id}`}
                className="flex h-[36px] items-center gap-[5px] rounded-[9px] border border-border-strong bg-bg-chip px-[11px] text-[13px] font-semibold text-fg-400 active:bg-bg-subtle"
              >
                {c.is_private ? <Lock className="size-[12px] text-tertiary" aria-hidden="true" /> : <span className="text-tertiary">#</span>}
                {c.name}
              </MobileLink>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

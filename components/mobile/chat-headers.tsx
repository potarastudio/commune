"use client";

import { Lock, MoreVertical, Users } from "lucide-react";
import { usePresenceKnown } from "@/components/presence/online-dot";
import { conversationLabel, type ConversationMember } from "@/lib/queries/conversations";
import { useProfileMap } from "@/lib/queries/profiles";
import { usePresenceStore } from "@/lib/store/presence";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { useThreadNav } from "@/lib/utils/use-thread-nav";
import { HeaderIconButton, PushedHeader } from "./screen-header";
import { RoundFace } from "./ui";

/**
 * A channel, pushed (design: Mobile Navigation → Push): "# design" with the
 * hash in the tertiary grey, the member count under it, then the huddle,
 * members and more — 44px each.
 */
export function ChannelScreenHeader({
  name,
  isPrivate,
  memberCount,
  subtitle,
  huddle,
}: {
  name: string;
  isPrivate: boolean;
  memberCount: number;
  /** Replaces the member count, e.g. "Opened from a notification". */
  subtitle?: string;
  huddle?: React.ReactNode;
}) {
  const { showPanel } = useThreadNav();
  return (
    <PushedHeader
      title={
        <>
          {isPrivate ? (
            <Lock className="size-[13px] shrink-0 text-tertiary" aria-hidden="true" />
          ) : (
            <span className="text-tertiary" aria-hidden="true">
              #
            </span>
          )}
          <span className="min-w-0 truncate">{name}</span>
        </>
      }
      subtitle={subtitle ?? `${memberCount} ${memberCount === 1 ? "member" : "members"}`}
    >
      {huddle}
      <HeaderIconButton label="Members" onClick={() => showPanel("details", "members")}>
        <Users className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
      </HeaderIconButton>
      <HeaderIconButton label="Channel details" onClick={() => showPanel("details", "about")}>
        <MoreVertical className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
      </HeaderIconButton>
    </PushedHeader>
  );
}

function localClock(timezone: string, now = new Date()): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  } catch {
    return null;
  }
}

/**
 * A DM, pushed (design: Mobile Core Screens → DM): the person rides in the
 * header — their face and presence, and their local time, which is what you
 * want to know before typing.
 */
export function DmScreenHeader({
  members,
  meId,
  subtitle,
  huddle,
}: {
  members: ConversationMember[];
  meId: string;
  subtitle?: string;
  huddle?: React.ReactNode;
}) {
  const { showPanel } = useThreadNav();
  const hydrated = useHydrated();
  const online = usePresenceStore((s) => s.online);
  const presenceKnown = usePresenceKnown();
  const profiles = useProfileMap();
  const others = members.filter((m) => m.id !== meId);
  const single = others.length === 1 ? others[0] : null;
  const isOnline = single ? online.has(single.id) : false;
  const tz = single && hydrated ? profiles.get(single.id)?.timezone : undefined;
  const clock = tz ? localClock(tz) : null;

  const line =
    subtitle ??
    (single
      ? [presenceKnown ? (isOnline ? "Active now" : "Away") : null, clock ? `${clock} local` : null].filter(Boolean).join(" · ")
      : others.length === 0
        ? "Just you"
        : `${members.length} people`);

  return (
    <PushedHeader
      title={conversationLabel(members, meId)}
      subtitle={line || undefined}
      leading={
        <span className="relative mr-[4px] block size-[30px] shrink-0" aria-hidden="true">
          <RoundFace person={single ?? others[0] ?? members[0]} size={30} />
          {single && isOnline && <span className="absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-bg-main bg-presence" />}
        </span>
      }
    >
      {huddle}
      <HeaderIconButton label="Conversation details" onClick={() => showPanel("details", "members")}>
        <MoreVertical className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
      </HeaderIconButton>
    </PushedHeader>
  );
}

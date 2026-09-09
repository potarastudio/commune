"use client";

import { ChevronDown, Clock, FileText } from "lucide-react";
import { PresenceDot, usePresenceKnown } from "@/components/presence/online-dot";
import { ProfileCard } from "@/components/profile/profile-card";
import { UserStatus } from "@/components/profile/user-status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { conversationLabel, type ConversationMember } from "@/lib/queries/conversations";
import { useContainerFiles } from "@/lib/queries/files";
import type { Container } from "@/lib/queries/messages";
import { useProfileMap } from "@/lib/queries/profiles";
import { usePresenceStore } from "@/lib/store/presence";
import { localTimeLabel } from "@/lib/utils/status";
import { useThreadNav } from "@/lib/utils/use-thread-nav";

/** The viewer's own zone, so the away line only names their clock when it differs. */
function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Asia/Jakarta";
  }
}

/**
 * Their wall clock, for the header's "Active now · 15:04 local". The design
 * carries it in both header variants regardless of the viewer's own zone, so
 * unlike `localTimeLabel` this does not drop out when the two match. It only
 * renders once their profile has loaded on the client, so there is nothing for
 * the server to disagree with.
 */
function localClock(timezone: string, now = new Date()): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  } catch {
    return null;
  }
}

/**
 * Header chip: how many files have been shared in this conversation. The DM
 * header's one count chip is files where the channel header's is pins (the
 * design draws #u-file-text in all three DM variants); it opens the details
 * panel on its Files tab, from which Pins is one tab away.
 */
export function DmFilesButton({ container }: { container: Container }) {
  const { openPanel, panelTab, showPanel, closePanel } = useThreadNav();
  const { data } = useContainerFiles(container);
  const count = data?.length ?? 0;
  const open = openPanel === "details" && panelTab === "files";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => (open ? closePanel() : showPanel("details", "files"))}
          aria-pressed={open}
          aria-label={count === 1 ? "1 shared file" : `${count} shared files`}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-[9px] text-[13px] font-medium shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            open
              ? "border-accent-surface-border bg-accent-surface text-accent-foreground hover:border-accent-border"
              : "border-border-strong bg-bg-card text-fg-400 hover:border-border-hover hover:bg-bg-card-hover"
          }`}
        >
          <FileText className={`size-[15px] ${open ? "" : "text-fg-600"}`} aria-hidden="true" />
          <span className="tabular-nums">{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{open ? "Hide shared files" : "Shared files"}</TooltipContent>
    </Tooltip>
  );
}

/** "you, Sari and Raka" */
function joinNames(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Person avatar. The shared primitive already carries the round shape,
 * --bg-avatar and the inset --avatar-ring hairline, so callers only pass a
 * size when it is off the default 32px step.
 */
function HeadAvatar({ person, className = "" }: { person: ConversationMember; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={person.avatar_url ?? undefined} alt="" />
      <AvatarFallback>{person.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

/**
 * A DM header leads with people, not a name: avatar (with presence), who they
 * are, and how to reach them. Group DMs swap the avatar for an overlapping
 * stack and the sub-line for a head count. 56px so its hairline lines up with
 * the thread and details panels.
 */
export function DmHeader({
  members,
  meId,
  huddle,
  files,
}: {
  members: ConversationMember[];
  meId: string;
  huddle?: React.ReactNode;
  files?: React.ReactNode;
}) {
  const { showPanel } = useThreadNav();
  const profiles = useProfileMap();
  const online = usePresenceStore((s) => s.online);

  const others = members.filter((m) => m.id !== meId);
  const label = conversationLabel(members, meId, { short: true });
  const single = others.length === 1 ? others[0] : null;
  const shown = others.length === 0 ? members : others;
  // Nobody is "Away" until the workspace presence channel has actually reported.
  const presenceKnown = usePresenceKnown();
  const isHere = single ? online.has(single.id) : false;

  let subline: string;
  if (single) {
    const their = profiles.get(single.id);
    // The design's sub-line is always two parts — "Active now · 15:04 local",
    // "Away · likely back after 16:00" — so their clock stays even when the
    // whole team shares one timezone.
    const local = their ? localClock(their.timezone ?? "Asia/Jakarta") : null;
    // Presence and time only — @handle and title live on the profile card.
    const parts: string[] = [];
    if (presenceKnown) parts.push(isHere ? "Active now" : "Away");
    if (local) parts.push(`${local} local`);
    subline = parts.join(" · ");
  } else if (others.length === 0) {
    subline = "Notes to yourself · nobody else can see them";
  } else {
    subline = `${members.length} people · ${joinNames(["you", ...others.map((m) => m.display_name.split(" ")[0])])}`;
  }

  const identity = (
    <>
      {single ? (
        <span className="relative block size-8 shrink-0">
          <HeadAvatar person={single} />
          {presenceKnown && <PresenceDot active={isHere} className="absolute -right-px -bottom-px block" />}
        </span>
      ) : (
        <span className="flex shrink-0">
          {shown.slice(0, 3).map((m, i) => (
            <span key={m.id} className={`block rounded-full shadow-[0_0_0_2px_var(--bg-main)] ${i > 0 ? "-ml-[9px]" : ""}`}>
              <HeadAvatar person={m} className="size-[30px]" />
            </span>
          ))}
        </span>
      )}
      <span className="min-w-0 text-left">
        <span className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">{label}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {subline && <span className="truncate text-[12px] text-muted-foreground">{subline}</span>}
          {single && (
            <UserStatus
              userId={single.id}
              withText
              className="shrink-0 rounded-sm border border-border-strong bg-bg-chip px-1.5 py-px text-[11px] font-semibold text-fg-600"
            />
          )}
        </span>
      </span>
    </>
  );

  const shell = "-ml-1.5 flex min-w-0 items-center gap-[11px] rounded-[9px] py-[5px] pr-2 pl-1.5 hover:bg-bg-subtle";
  const chevron = <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;

  return (
    <header className="flex h-14 shrink-0 items-center gap-[11px] border-b border-border px-5">
      {/* The button's accessible name is its own content, so the handle, title,
          presence and local time stay reachable instead of being replaced. */}
      <h1 className="flex min-w-0">
        {single ? (
          <ProfileCard userId={single.id}>
            <button type="button" className={shell}>
              {identity}
              {chevron}
            </button>
          </ProfileCard>
        ) : others.length > 1 ? (
          <button type="button" onClick={() => showPanel("details", "members")} className={shell}>
            {identity}
            {chevron}
          </button>
        ) : (
          <span className="-ml-1.5 flex min-w-0 items-center gap-[11px] py-[5px] pr-2 pl-1.5">{identity}</span>
        )}
      </h1>

      {/* The design's DM header carries one 32px count chip — files — and the
          Huddle button; people and pins are reached from the details panel. */}
      <span className="ml-auto flex shrink-0 items-center gap-2.5">
        {files}
        {huddle}
      </span>
    </header>
  );
}

/**
 * Says they are away before you type, not after you send — and what time it is
 * where they are. Only for 1:1s, and only once presence has actually loaded.
 * The design puts this in the 22px line directly above the composer, not as a
 * banner over the log, so it goes through `ComposerNoticeProvider`.
 */
export function DmAwayNotice({ person }: { person: ConversationMember }) {
  const online = usePresenceStore((s) => s.online);
  const their = useProfileMap().get(person.id);

  if (online.size === 0 || online.has(person.id)) return null;
  const first = person.display_name.split(" ")[0];
  const local = their ? localTimeLabel(their.timezone ?? "Asia/Jakarta", viewerTimezone()) : null;

  return (
    <div className="shrink-0 px-6">
      <p className="flex h-[22px] items-center gap-[7px] px-0.5 text-[12.5px] text-muted-foreground">
        <Clock className="size-[13px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {local ? `${first} is away — it is ${local} where they are.` : `${first} is away — they will see this when they are back.`}
        </span>
      </p>
    </div>
  );
}

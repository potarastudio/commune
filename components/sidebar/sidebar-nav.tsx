"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AtSign,
  BellOff,
  Bookmark,
  ChevronRight,
  Compass,
  Hash,
  Lock,
  MessageSquareText,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateChannelPopover } from "@/components/channel/create-channel-popover";
import { AvatarPresence, usePresenceKnown } from "@/components/presence/online-dot";
import { UserStatus } from "@/components/profile/user-status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { JoinedChannel } from "@/lib/queries/channels";
import { conversationLabel, type ConversationSummary } from "@/lib/queries/conversations";
import type { Profile } from "@/lib/queries/profile";
import { fetchUnreadMap, unreadKeys, useUnreadCounts, type UnreadMap } from "@/lib/queries/unreads";
import { useUiStore } from "@/lib/store/ui";
import { UserMenu } from "./user-menu";

/* ── The 64px rail ────────────────────────────────────────────────────────────
   Near-black in both themes (--rail), so it never inherits the page surface.  */

const RAIL_ITEM =
  "relative flex min-h-[44px] w-[44px] flex-col items-center justify-center gap-[3px] rounded-lg py-[7px] transition-colors";
const RAIL_ICON_BUTTON =
  "grid size-[34px] place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white";

/**
 * Workspace rail: logo, the five top-level destinations, then theme, settings
 * and the account menu pinned to the bottom.
 */
export function WorkspaceRail({
  profile,
  channels,
  initialUnreads,
}: {
  profile: Profile;
  channels: JoinedChannel[];
  initialUnreads: UnreadMap;
}) {
  const pathname = usePathname();
  // Shares the cache (and so the realtime patches) with SidebarNav's useUnreadCounts
  // rather than opening a second subscription for the same rows.
  const { data: unreads } = useQuery({
    queryKey: unreadKeys.all,
    queryFn: fetchUnreadMap,
    initialData: initialUnreads,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const mutedKeys = new Set(channels.filter((c) => c.notification_level === "muted").map((c) => `channel:${c.id}`));
  const mentionCount = Object.entries(unreads).filter(
    ([key, u]) => u.has_mention && u.unread > 0 && !mutedKeys.has(key),
  ).length;

  const items = [
    { href: "/channels", label: "Channels", Icon: Hash, active: pathname === "/" || pathname.startsWith("/channel"), badge: 0 },
    { href: "/activity", label: "Activity", Icon: AtSign, active: pathname.startsWith("/activity"), badge: mentionCount },
    { href: "/dm/new", label: "DMs", Icon: MessageSquareText, active: pathname.startsWith("/dm"), badge: 0 },
    { href: "/saved", label: "Saved", Icon: Bookmark, active: pathname.startsWith("/saved"), badge: 0 },
    { href: "/search", label: "Search", Icon: Search, active: pathname.startsWith("/search"), badge: 0 },
  ];

  return (
    <nav aria-label="Workspace" className="flex w-[64px] shrink-0 flex-col items-center bg-rail pt-[10px] pb-[12px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/"
            aria-label="Potara Studio"
            className="block size-[36px] shrink-0 overflow-hidden rounded-lg bg-primary"
          >
            <Image src="/commune-logo.png" alt="" width={36} height={36} priority className="size-[36px] scale-110 object-cover" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">Potara Studio</TooltipContent>
      </Tooltip>

      <span className="mt-[12px] mb-[8px] h-px w-[24px] shrink-0 bg-white/10" aria-hidden="true" />

      <ul className="flex w-full flex-col items-center gap-[6px]">
        {items.map(({ href, label, Icon, active, badge }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${RAIL_ITEM} ${active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}
            >
              <Icon className="size-[17px] shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-medium tracking-[0.01em]">{label}</span>
              {badge > 0 && (
                <span
                  className="absolute top-[4px] right-[6px] inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-rail bg-primary px-[3px] text-[9.5px] font-bold text-white tabular-nums"
                  aria-label={`${badge} conversation${badge === 1 ? "" : "s"} with unread mentions`}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col items-center gap-[8px] pt-[12px]">
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings" aria-label="Settings" className={RAIL_ICON_BUTTON}>
              <Settings className="size-[17px]" aria-hidden="true" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
        <UserMenu profile={profile} />
      </div>
    </nav>
  );
}

/** Light ⇄ dark. Renders the same icon on the server and first paint. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} onClick={() => setTheme(dark ? "light" : "dark")} className={RAIL_ICON_BUTTON}>
          {dark ? <Sun className="size-[17px]" aria-hidden="true" /> : <Moon className="size-[17px]" aria-hidden="true" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ── The 272px channel column ─────────────────────────────────────────────── */

/** Sidebar lists with unread bold + badges (§5). Sections collapse and remember it. */
export function SidebarNav({
  me,
  channels,
  conversations,
  initialUnreads,
}: {
  me: Profile;
  channels: JoinedChannel[];
  conversations: ConversationSummary[];
  initialUnreads: UnreadMap;
}) {
  const pathname = usePathname();
  const unreads = useUnreadCounts(initialUnreads, me.id);
  const collapsed = useUiStore((s) => s.collapsed);
  const toggleSection = useUiStore((s) => s.toggleSection);
  // Once presence has reported, someone who is not in it is away — the DM row
  // draws the same hollow ring the DM header draws for that person.
  const presenceKnown = usePresenceKnown();

  const isActive = (href: string) => pathname === href;

  const badgeFor = (key: string, level: JoinedChannel["notification_level"] = "all") => {
    const u = unreads[key];
    if (!u || u.unread === 0 || level === "muted") return { bold: false, count: 0, mention: false };
    if (level === "mentions" && !u.has_mention) return { bold: false, count: 0, mention: false };
    return { bold: true, count: u.unread, mention: u.has_mention };
  };

  // Collapsed sections still show anything unread, like Slack.
  const channelsOpen = !collapsed.channels;
  const dmsOpen = !collapsed.dms;

  return (
    <nav className="flex-1 overflow-y-auto px-[8px] pb-[16px]" aria-label="Sidebar">
      <SectionHeader
        label="Channels"
        open={channelsOpen}
        onToggle={() => toggleSection("channels")}
        action={
          <CreateChannelPopover align="start">
            <button
              type="button"
              aria-label="Create channel"
              className="ml-auto grid size-[22px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-avatar hover:text-ink"
            >
              <Plus className="size-[14px]" aria-hidden="true" />
            </button>
          </CreateChannelPopover>
        }
      />
      <ul className="mb-[14px] flex flex-col gap-px">
        {channels.map((c) => {
          const href = `/channel/${c.id}`;
          const badge = badgeFor(`channel:${c.id}`, c.notification_level);
          const active = isActive(href);
          if (!channelsOpen && !badge.bold && !active) return null;
          const muted = c.notification_level === "muted";
          return (
            <li key={c.id}>
              <NavLink
                href={href}
                active={active}
                bold={badge.bold}
                count={badge.count}
                mention={badge.mention}
                unreadStyle={badge.mention ? "count" : "dot"}
              >
                {c.is_private ? (
                  <Lock
                    className={`mx-[0.5px] size-[13px] shrink-0 ${active ? "text-primary" : "text-tertiary"}`}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`w-[14px] shrink-0 text-center text-[14px] ${
                      active ? "font-semibold text-primary" : badge.bold ? "font-medium text-muted-foreground" : "font-medium text-tertiary"
                    }`}
                  >
                    #
                  </span>
                )}
                {/* Muted rows drop to tertiary ink — but never on the active card, which is already ink on bg-card. */}
                <span className={`min-w-0 truncate ${muted && !active ? "text-tertiary" : ""}`}>{c.name}</span>
                {muted && <BellOff className="ml-auto size-[13px] shrink-0 text-tertiary" aria-label="Muted" />}
              </NavLink>
            </li>
          );
        })}
        {channelsOpen && (
          <li>
            <NavLink href="/channels" active={isActive("/channels")} bold={false} count={0} mention={false} tone="muted">
              <Compass className="size-[14px] shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">Browse channels</span>
            </NavLink>
          </li>
        )}
      </ul>

      <SectionHeader
        label="Direct messages"
        open={dmsOpen}
        onToggle={() => toggleSection("dms")}
        action={
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/dm/new"
                aria-label="New message"
                className="ml-auto grid size-[22px] shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-bg-avatar hover:text-ink"
              >
                <Plus className="size-[14px]" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">New message</TooltipContent>
          </Tooltip>
        }
      />
      <ul className="flex flex-col gap-px">
        {conversations.map((c) => {
          const href = `/dm/${c.id}`;
          const badge = badgeFor(`conversation:${c.id}`);
          const active = isActive(href);
          if (!dmsOpen && !badge.bold && !active) return null;
          const others = c.members.filter((m) => m.id !== me.id);
          const face = others[0] ?? me;
          return (
            <li key={c.id}>
              {/* A DM is addressed to you by definition, so it always counts rather than dots. */}
              <NavLink href={href} active={active} bold={badge.bold} count={badge.count} mention={badge.mention} unreadStyle="count">
                {others.length > 1 ? (
                  <span
                    aria-hidden="true"
                    className="grid size-[22px] shrink-0 place-items-center rounded-full border border-border-strong bg-bg-groupdm text-[10.5px] font-semibold text-fg-600 tabular-nums"
                  >
                    {c.members.length}
                  </span>
                ) : (
                  <span className="relative block size-[22px] shrink-0">
                    <Avatar className="size-[22px] rounded-full bg-bg-avatar">
                      <AvatarImage src={face.avatar_url ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="rounded-full bg-bg-avatar text-[10px] font-semibold text-fg-600">
                        {face.display_name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {others.length === 1 && <AvatarPresence userId={face.id} ring="border-bg-col" size="sm" away={presenceKnown} />}
                  </span>
                )}
                <span className="min-w-0 truncate">{conversationLabel(c.members, me.id, { short: true })}</span>
                {others.length === 1 && <UserStatus userId={face.id} className="shrink-0" />}
              </NavLink>
            </li>
          );
        })}
        {conversations.length === 0 && dmsOpen && (
          <li className="px-[8px] py-[4px] text-[13px] text-muted-foreground">
            No conversations yet.{" "}
            <Link href="/dm/new" className="link-ink">
              Message someone
            </Link>
            .
          </li>
        )}
      </ul>
    </nav>
  );
}

function SectionHeader({ label, open, onToggle, action }: { label: string; open: boolean; onToggle: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex h-[28px] items-center gap-[4px] px-[8px]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-w-0 items-center gap-[4px] rounded-sm text-[12.5px] font-semibold text-fg-600 transition-colors hover:text-ink"
      >
        <ChevronRight
          className={`size-[13px] shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </button>
      {action}
    </div>
  );
}

function NavLink({
  href,
  active,
  bold,
  count,
  mention,
  unreadStyle = "dot",
  tone,
  children,
}: {
  href: string;
  active: boolean;
  bold: boolean;
  count: number;
  mention: boolean;
  /** Three weights: a count for mentions, a dot for ordinary unreads, bold type for both. */
  unreadStyle?: "dot" | "count";
  tone?: "muted";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-[34px] items-center gap-[9px] rounded-md text-[14px] transition-colors ${
        active
          ? "border border-border-strong bg-bg-card px-[7px] font-semibold text-ink shadow-xs"
          : bold
            ? "px-[8px] font-semibold text-ink hover:bg-bg-avatar"
            : tone === "muted"
              ? "px-[8px] text-muted-foreground hover:bg-bg-avatar hover:text-ink"
              : "px-[8px] text-fg-500 hover:bg-bg-avatar hover:text-ink"
      }`}
    >
      {children}
      {count > 0 &&
        !active &&
        (unreadStyle === "count" ? (
          <span
            className="ml-auto shrink-0 rounded-full bg-primary px-[6px] text-[11.5px] leading-[18px] font-semibold text-white tabular-nums"
            aria-label={`${count} unread${mention ? ", mentions you" : ""}`}
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : (
          <span
            role="img"
            aria-label={`${count} unread`}
            className="ml-auto size-[7px] shrink-0 rounded-full bg-primary"
          />
        ))}
    </Link>
  );
}

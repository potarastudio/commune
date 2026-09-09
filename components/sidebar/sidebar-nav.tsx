"use client";

import { AtSign, Bookmark, ChevronRight, Compass, Hash, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { JoinedChannel } from "@/lib/queries/channels";
import { conversationLabel, type ConversationSummary } from "@/lib/queries/conversations";
import type { Profile } from "@/lib/queries/profile";
import { useUnreadCounts, type UnreadMap } from "@/lib/queries/unreads";
import { useUiStore } from "@/lib/store/ui";
import { AvatarPresence } from "@/components/presence/online-dot";
import { UserStatus } from "@/components/profile/user-status";
import { CreateChannelPopover } from "@/components/channel/create-channel-popover";

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
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Sidebar">
      <ul className="mb-4">
        <li>
          <NavLink href="/activity" active={isActive("/activity")} bold={false} count={0} mention={false}>
            <AtSign className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
            <span className="truncate">Activity</span>
          </NavLink>
        </li>
        <li>
          <NavLink href="/saved" active={isActive("/saved")} bold={false} count={0} mention={false}>
            <Bookmark className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
            <span className="truncate">Saved</span>
          </NavLink>
        </li>
      </ul>
      <SectionHeader
        label="Channels"
        open={channelsOpen}
        onToggle={() => toggleSection("channels")}
        action={
          <CreateChannelPopover align="start">
            <button
              type="button"
              aria-label="Create channel"
              className="grid size-6 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </CreateChannelPopover>
        }
      />
      <ul className="mb-4">
        {channels.map((c) => {
          const href = `/channel/${c.id}`;
          const badge = badgeFor(`channel:${c.id}`, c.notification_level);
          if (!channelsOpen && !badge.bold && !isActive(href)) return null;
          const Icon = c.is_private ? Lock : Hash;
          return (
            <li key={c.id}>
              <NavLink href={href} active={isActive(href)} bold={badge.bold} count={badge.count} mention={badge.mention} muted={c.notification_level === "muted"}>
                <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                <span className="truncate">{c.name}</span>
              </NavLink>
            </li>
          );
        })}
        {channelsOpen && (
          <li>
            <NavLink href="/channels" active={isActive("/channels")} bold={false} count={0} mention={false} muted>
              <Compass className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="truncate">Browse channels</span>
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
                className="grid size-6 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">New message</TooltipContent>
          </Tooltip>
        }
      />
      <ul>
        {conversations.map((c) => {
          const href = `/dm/${c.id}`;
          const badge = badgeFor(`conversation:${c.id}`);
          if (!dmsOpen && !badge.bold && !isActive(href)) return null;
          const others = c.members.filter((m) => m.id !== me.id);
          const face = others[0] ?? me;
          return (
            <li key={c.id}>
              <NavLink href={href} active={isActive(href)} bold={badge.bold} count={badge.count} mention={badge.mention}>
                {others.length > 1 ? (
                  <span className="grid size-4 shrink-0 place-items-center rounded-sm bg-sidebar-active text-[10px] font-semibold tabular-nums">
                    {c.members.length}
                  </span>
                ) : (
                  <span className="relative shrink-0">
                    <Avatar className="size-4 rounded-sm">
                      <AvatarImage src={face.avatar_url ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="rounded-sm bg-sidebar-active text-[9px] font-semibold">
                        {face.display_name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {others.length === 1 && <AvatarPresence userId={face.id} ring="border-sidebar" />}
                  </span>
                )}
                <span className="truncate">{conversationLabel(c.members, me.id, { short: true })}</span>
                {others.length === 1 && <UserStatus userId={face.id} className="shrink-0" />}
              </NavLink>
            </li>
          );
        })}
        {conversations.length === 0 && dmsOpen && (
          <li className="px-2 py-1 text-[12px] text-sidebar-muted">
            No conversations yet.{" "}
            <Link href="/dm/new" className="underline underline-offset-2 hover:text-sidebar-foreground">
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
    <div className="mb-0.5 flex items-center justify-between pr-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium uppercase tracking-[0.08em] text-sidebar-muted hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
        {label}
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
  muted,
  children,
}: {
  href: string;
  active: boolean;
  bold: boolean;
  count: number;
  mention: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-7 items-center gap-2 rounded-md px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${
        active
          ? "bg-sidebar-active text-sidebar-active-foreground"
          : bold
            ? "text-sidebar-unread hover:bg-sidebar-hover"
            : muted
              ? "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              : "text-sidebar-foreground/85 hover:bg-sidebar-hover hover:text-sidebar-foreground"
      } ${bold && !active ? "font-semibold" : ""}`}
    >
      {children}
      {count > 0 && !active && (
        <span
          className={`ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums leading-[18px] ${
            mention ? "bg-destructive text-white" : "bg-sidebar-foreground/90 text-sidebar"
          }`}
          aria-label={`${count} unread${mention ? ", mentions you" : ""}`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

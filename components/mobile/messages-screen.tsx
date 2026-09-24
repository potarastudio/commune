"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Search, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePresenceKnown } from "@/components/presence/online-dot";
import { conversationLabel, type ConversationMember, type ConversationSummary } from "@/lib/queries/conversations";
import { markReadAction } from "@/lib/actions/messages";
import { clearUnread, useUnreadCounts } from "@/lib/queries/unreads";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { usePresenceStore } from "@/lib/store/presence";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { listTime } from "@/lib/utils/list-time";
import { unreadBadge, type UnreadMap } from "@/lib/utils/unreads";
import { useViewerTimezone } from "@/lib/viewer-timezone";
import { CountPill, useScrollToTopOnReselect } from "./channels-screen";
import { MobileLink } from "./mobile-link";
import { HeaderIconButton, RootHeader } from "./screen-header";
import { SwipeRow } from "./swipe-row";
import { useMobileNav } from "./use-mobile-nav";

function Face({ person, size }: { person: ConversationMember; size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-bg-avatar shadow-[inset_0_0_0_1px_var(--avatar-ring)]"
      style={{ width: size, height: size }}
    >
      {person.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars come from storage and Google, sized by CSS
        <img src={person.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[14px] font-semibold text-fg-600">{person.display_name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

/** A 44px face with presence for a DM; two overlapping 34px faces for a group. */
export function ConversationFace({ members, meId, presence }: { members: ConversationMember[]; meId: string; presence: "on" | "off" | "unknown" }) {
  const others = members.filter((m) => m.id !== meId);
  const shown = others.length === 0 ? members : others;
  if (shown.length > 1) {
    return (
      <span className="relative block size-[44px] shrink-0" aria-hidden="true">
        <span className="flex">
          <Face person={shown[0]} size={34} />
          <span className="-ml-[14px] block rounded-full shadow-[0_0_0_2px_var(--bg-main)]">
            <Face person={shown[1]} size={34} />
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="relative block size-[44px] shrink-0" aria-hidden="true">
      <Face person={shown[0]} size={44} />
      {presence === "on" && (
        <span className="absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-bg-main bg-presence" />
      )}
    </span>
  );
}

/**
 * Messages, the DMs tab's root (design: Mobile Core Screens → Messages). Two
 * lines and a 44px face per conversation, because on a phone you choose from
 * the list rather than from a glance at unread dots. Previews refresh when a
 * direct message arrives.
 */
export function MessagesScreen({
  meId,
  conversations,
  initialUnreads,
}: {
  meId: string;
  conversations: ConversationSummary[];
  initialUnreads: UnreadMap;
}) {
  const nav = useMobileNav();
  const router = useRouter();
  const tz = useViewerTimezone();
  const unreads = useUnreadCounts(initialUnreads, meId);
  const online = usePresenceStore((s) => s.online);
  const presenceKnown = usePresenceKnown();
  const list = useScrollToTopOnReselect("dms");
  const queryClient = useQueryClient();
  const markRead = (id: string) => {
    const container = { kind: "conversation" as const, id };
    clearUnread(queryClient, container);
    void markReadAction({ container });
  };

  // A new direct message changes a preview and the order; the list is server-rendered, so refresh it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = subscribeWithAuth(
      getSupabaseBrowserClient(),
      "dm-list",
      (channel) =>
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          if (!(payload.new as { conversation_id?: string | null }).conversation_id) return;
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 400);
        }),
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [router]);

  return (
    <>
      <RootHeader title="Messages">
        <HeaderIconButton label="New message" onClick={() => nav.push("/dm/new")}>
          <SquarePen className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
        </HeaderIconButton>
      </RootHeader>
      <div className="shrink-0 px-[16px] pt-[10px] pb-[12px]">
        <button
          type="button"
          onClick={() => nav.push("/search")}
          className="flex h-[38px] w-full items-center gap-[9px] rounded-[10px] border border-border-strong bg-bg-chip px-[12px] text-left text-[14px] text-muted-foreground"
        >
          <Search className="size-[16px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Search messages
        </button>
      </div>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {conversations.length === 0 ? (
          <div className="px-[24px] pt-[40px] text-center">
            <p className="text-[15px] font-semibold text-ink">No conversations yet</p>
            <p className="mt-[6px] text-[13.5px] leading-[1.55] text-fg-600">Start one with anyone in the studio.</p>
            <button
              type="button"
              onClick={() => nav.push("/dm/new")}
              className="mx-auto mt-[16px] flex h-[44px] items-center rounded-[12px] border border-accent-border bg-primary px-[16px] text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            >
              New message
            </button>
          </div>
        ) : (
          <ul>
            {conversations.map((c) => {
              const badge = unreadBadge(unreads, `conversation:${c.id}`);
              const others = c.members.filter((m) => m.id !== meId);
              const single = others.length === 1 ? others[0] : null;
              const presence = single ? (online.has(single.id) ? "on" : presenceKnown ? "off" : "unknown") : "unknown";
              const mine = c.last_message_author_id === meId;
              const preview = c.last_message_text ? `${mine ? "You: " : ""}${c.last_message_text}` : "No messages yet";
              return (
                <li key={c.id}>
                  <SwipeRow actions={[{ label: "Read", icon: <CheckCheck aria-hidden="true" />, onSelect: () => markRead(c.id) }]}>
                    <MobileLink
                      href={`/dm/${c.id}`}
                      data-long-press=""
                      className="flex items-center gap-[12px] px-[16px] py-[11px] active:bg-bg-subtle"
                    >
                      <ConversationFace members={c.members} meId={meId} presence={presence} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-[8px]">
                          <span className={cn("min-w-0 truncate text-[15px]", badge.bold ? "font-semibold text-ink" : "font-medium text-fg-400")}>
                            {conversationLabel(c.members, meId, { short: others.length > 1 })}
                          </span>
                          {c.last_message_at && (
                            <span suppressHydrationWarning className="ml-auto shrink-0 text-[11.5px] text-muted-foreground tabular-nums">
                              {listTime(c.last_message_at, tz)}
                            </span>
                          )}
                        </span>
                        <span className="mt-[2px] flex items-center gap-[8px]">
                          <span className={cn("min-w-0 flex-1 truncate text-[13px]", badge.bold ? "text-body" : "text-muted-foreground")}>{preview}</span>
                          {badge.count > 0 && <CountPill count={badge.count} label={`${badge.count} unread`} />}
                        </span>
                      </span>
                    </MobileLink>
                  </SwipeRow>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

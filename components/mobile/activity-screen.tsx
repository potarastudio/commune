import { AtSign, MessageSquareText, SmilePlus } from "lucide-react";
import Link from "next/link";
import { RemindersList } from "@/components/activity/reminders-list";
import { isNewSince, messageHref, type MentionActivity, type ReactionActivity } from "@/lib/queries/activity";
import type { UpcomingReminder } from "@/lib/queries/use-scheduling";
import { cn } from "@/lib/utils";
import { feedTime } from "@/lib/utils/list-time";
import { renderContent } from "@/lib/utils/render";
import { SectionLabel } from "./channels-screen";
import { FeedItem } from "./feed-item";
import { MarkReadButton } from "./mark-read-button";
import { RootHeader } from "./screen-header";
import { TabScroll } from "./tab-scroll";
import { MobileEmpty } from "./ui";

export type ActivityTab = "all" | "mentions" | "reactions" | "threads";

const TABS: { id: ActivityTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "reactions", label: "Reactions" },
  { id: "threads", label: "Threads" },
];

type Place = { channel: { id: string; name: string } | null; conversation: { id: string } | null };

function where(m: Place) {
  return m.channel ? `#${m.channel.name}` : "a direct message";
}

/**
 * Activity, the second tab (design: Mobile Core Screens → Activity). Every
 * item carries the message it is about — "Sari reacted 🔥" means nothing on a
 * phone where you cannot see what she reacted to. Filters are chips you can
 * reach with a thumb; the list pulls to refresh.
 */
export function ActivityScreen({
  tab,
  handle,
  mentions,
  reactions,
  reminders,
  readMarks,
  timeZone,
}: {
  tab: ActivityTab;
  handle: string;
  mentions: MentionActivity[];
  reactions: ReactionActivity[];
  reminders: UpcomingReminder[];
  readMarks: Record<string, string>;
  timeZone: string;
}) {
  const now = new Date();
  type Row = { key: string; at: string; thread: boolean; node: React.ReactNode };

  const mentionRows: Row[] = mentions.map((m) => ({
    key: `m-${m.id}`,
    at: m.message.created_at,
    thread: m.message.parent_id !== null,
    node: (
      <FeedItem
        key={`m-${m.id}`}
        href={messageHref(m.message)}
        person={m.message.author}
        badge={<AtSign />}
        badgeTone="accent"
        unread={isNewSince(readMarks, m.message, m.message.created_at)}
        time={feedTime(m.message.created_at, timeZone, now)}
        eyebrow={
          <>
            <span className="font-semibold text-ink">{m.message.author?.display_name ?? "Someone"}</span>{" "}
            {m.kind === "user" ? "mentioned you in" : `used @${m.kind} in`}{" "}
            <span className="font-semibold">{where(m.message)}</span>
            {m.message.parent_id && " · in a thread"}
          </>
        }
      >
        {renderContent(m.message.content as Parameters<typeof renderContent>[0], { inert: true })}
      </FeedItem>
    ),
  }));

  const reactionRows: Row[] = reactions.map((r) => {
    const key = `r-${r.message.id}-${r.reactor?.id}-${r.emoji}`;
    return {
      key,
      at: r.created_at,
      thread: r.message.parent_id !== null,
      node: (
        <FeedItem
          key={key}
          href={messageHref(r.message)}
          person={r.reactor}
          badge={<SmilePlus />}
          time={feedTime(r.created_at, timeZone, now)}
          quote={r.message.content_text || "A message with a file"}
          eyebrow={
            <>
              <span className="font-semibold text-ink">{r.reactor?.display_name ?? "Someone"}</span> reacted {r.emoji} in{" "}
              <span className="font-semibold">{where(r.message)}</span>
            </>
          }
        >
          Your message
        </FeedItem>
      ),
    };
  });

  const rows = [...(tab === "reactions" ? [] : mentionRows), ...(tab === "mentions" ? [] : reactionRows)]
    .filter((row) => tab !== "threads" || row.thread)
    .sort((a, b) => b.at.localeCompare(a.at));

  const newMentions = mentions.filter((m) => isNewSince(readMarks, m.message, m.message.created_at)).length;

  const empty =
    tab === "mentions"
      ? { icon: <AtSign />, title: "No mentions waiting", body: `When someone writes @${handle}, @channel or @here, it lands here.` }
      : tab === "reactions"
        ? { icon: <SmilePlus />, title: "No reactions yet", body: "Reactions people leave on your messages collect here." }
        : tab === "threads"
          ? {
              icon: <MessageSquareText />,
              title: "Nothing from threads",
              body: "Mentions and reactions inside a thread collect here, so a long side conversation can’t bury them.",
            }
          : { icon: <AtSign />, title: "You’re all caught up", body: "Mentions, reactions and thread replies land here." };

  return (
    <>
      <RootHeader title="Activity">
        <MarkReadButton />
      </RootHeader>
      <nav
        aria-label="Filter activity"
        className="flex shrink-0 gap-[6px] overflow-x-auto border-b border-border bg-bg-main px-[16px] py-[10px] [scrollbar-width:none]"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.id === "all" ? "/activity" : `/activity?tab=${t.id}`}
              replace
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex h-[44px] shrink-0 items-center gap-[6px] rounded-[12px] border px-[12px] text-[13px] font-semibold whitespace-nowrap",
                active
                  ? "border-border-strong bg-bg-card text-ink shadow-[0_1px_2px_0_var(--shadow-tint-sm)]"
                  : "border-transparent bg-bg-chip text-fg-600 active:bg-bg-subtle",
              )}
            >
              {t.label}
              {t.id === "mentions" && newMentions > 0 && <span className="tabular-nums">{newMentions}</span>}
            </Link>
          );
        })}
      </nav>
      <TabScroll tab="activity" refreshLabel="Checking for new activity…">
        {tab === "all" && reminders.length > 0 && (
          <section className="border-b border-border">
            <SectionLabel>Reminders</SectionLabel>
            <RemindersList initial={reminders} timezone={timeZone} variant="mobile" />
          </section>
        )}
        {rows.length === 0 ? (
          <MobileEmpty icon={empty.icon} title={empty.title} body={empty.body} />
        ) : (
          <ul>{rows.map((row) => row.node)}</ul>
        )}
      </TabScroll>
    </>
  );
}

import type { Metadata } from "next";
import { AtSign, Hash, SmilePlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityItem } from "@/components/activity/activity-item";
import { RemindersList } from "@/components/activity/reminders-list";
import { fetchUpcomingReminders } from "@/lib/queries/scheduling";
import {
  getMentionsOfMe,
  getReactionsOnMyMessages,
  messageHref,
  type MentionActivity,
  type ReactionActivity,
} from "@/lib/queries/activity";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { renderContent } from "@/lib/utils/render";

export const metadata: Metadata = { title: "Activity" };

type Tab = "all" | "mentions" | "reactions";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "reactions", label: "Reactions" },
];

/** Times and day breaks follow the viewer's timezone (§6), resolved on the server. */
const dayKey = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(new Date(iso));
const clock = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

function dayLabel(iso: string, tz: string, now: Date) {
  const key = dayKey(iso, tz);
  if (key === dayKey(now.toISOString(), tz)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000).toISOString(), tz)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

type Container = { channel: { id: string; name: string } | null; conversation: { id: string } | null };

/** "#design" as the design draws it — a hash glyph then the name, both weighted. */
function Where({ container }: { container: Container }) {
  if (container.channel) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-fg-400">
        <Hash className="size-[11px] text-muted-foreground" aria-hidden="true" />
        {container.channel.name}
      </span>
    );
  }
  return <span className="font-semibold text-fg-400">a direct message</span>;
}

/** "Mentions & reactions" (§5): what other people did that involves you. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "mentions" || rawTab === "reactions" ? rawTab : "all";

  const [mentions, reactions, reminders] = await Promise.all([
    getMentionsOfMe(supabase, profile.id),
    getReactionsOnMyMessages(supabase, profile.id),
    fetchUpcomingReminders(supabase),
  ]);

  const tz = profile.timezone || "Asia/Jakarta";
  const now = new Date();

  type Row = { key: string; at: string; node: React.ReactNode };

  const mentionRow = (m: MentionActivity): Row => ({
    key: `m-${m.id}`,
    at: m.message.created_at,
    node: (
      <ActivityItem
        key={`m-${m.id}`}
        href={messageHref(m.message)}
        person={m.message.author}
        createdAt={m.message.created_at}
        timeLabel={clock(m.message.created_at, tz)}
        badge={<AtSign aria-hidden="true" />}
        badgeTone="accent"
        eyebrow={
          <>
            <span className="font-semibold text-ink">{m.message.author?.display_name ?? "Someone"}</span>
            <span>{m.kind === "user" ? "mentioned you in" : `used @${m.kind} in`}</span>
            <Where container={m.message} />
            {m.message.parent_id && <span className="text-muted-foreground">· in a thread</span>}
          </>
        }
      >
        {renderContent(m.message.content as Parameters<typeof renderContent>[0])}
      </ActivityItem>
    ),
  });

  const reactionRow = (r: ReactionActivity): Row => ({
    key: `r-${r.message.id}-${r.reactor?.id}-${r.emoji}`,
    at: r.created_at,
    node: (
      <ActivityItem
        key={`r-${r.message.id}-${r.reactor?.id}-${r.emoji}`}
        href={messageHref(r.message)}
        person={r.reactor}
        createdAt={r.created_at}
        timeLabel={clock(r.created_at, tz)}
        badge={<SmilePlus aria-hidden="true" />}
        quote={r.message.content_text}
        eyebrow={
          <>
            <span className="font-semibold text-ink">{r.reactor?.display_name ?? "Someone"}</span>
            <span>reacted with</span>
            <span className="text-[14px] leading-none">{r.emoji}</span>
            <span>in</span>
            <Where container={r.message} />
          </>
        }
      >
        Your message
      </ActivityItem>
    ),
  });

  const rows: Row[] = [
    ...(tab === "reactions" ? [] : mentions.map(mentionRow)),
    ...(tab === "mentions" ? [] : reactions.map(reactionRow)),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // One sticky overline per calendar day, as the design groups the feed.
  const days: { label: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const label = dayLabel(row.at, tz, now);
    const last = days.at(-1);
    if (last?.label === label) last.rows.push(row);
    else days.push({ label, rows: [row] });
  }

  const count =
    tab === "mentions"
      ? `${mentions.length} ${mentions.length === 1 ? "mention" : "mentions"}`
      : tab === "reactions"
        ? `${reactions.length} ${reactions.length === 1 ? "reaction" : "reactions"}`
        : `${rows.length} ${rows.length === 1 ? "item" : "items"}`;

  const empty =
    tab === "mentions"
      ? {
          icon: <AtSign className="size-[17px]" aria-hidden="true" />,
          title: "No mentions waiting",
          body: `When someone writes @${profile.handle}, @channel or @here, it lands here.`,
        }
      : tab === "reactions"
        ? {
            icon: <SmilePlus className="size-[17px]" aria-hidden="true" />,
            title: "No reactions yet",
            body: "Reactions people leave on your messages collect here. Say something worth a 🔥.",
          }
        : {
            icon: <AtSign className="size-[17px]" aria-hidden="true" />,
            title: "You’re all caught up",
            body: "Mentions, reactions and thread replies land here. Nothing waiting on you right now.",
          };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Activity</h1>
        <span className="text-[12.5px] text-muted-foreground">{count}</span>
      </header>

      <nav aria-label="Filter activity" className="flex shrink-0 gap-0.5 border-b border-border px-5 py-[9px]">
        {TABS.map((t) => {
          const active = t.id === tab;
          const n = t.id === "mentions" ? mentions.length : t.id === "reactions" ? reactions.length : 0;
          return (
            <Link
              key={t.id}
              href={t.id === "all" ? "/activity" : `/activity?tab=${t.id}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex h-[30px] items-center gap-[7px] rounded-md border px-[11px] text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-border-strong bg-bg-card text-ink shadow-xs"
                  : "border-transparent text-fg-600 hover:bg-bg-subtle hover:text-ink",
              )}
            >
              {t.label}
              {n > 0 && <span className="tabular-nums text-muted-foreground">{n}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {reminders.length > 0 && tab === "all" && (
          <section>
            <h2 className="sticky top-0 z-[2] border-b border-border-subtle bg-bg-main px-5 py-[9px] text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
              Reminders
            </h2>
            <RemindersList initial={reminders} timezone={tz} />
          </section>
        )}

        {days.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
            <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
              {empty.icon}
            </span>
            <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">{empty.title}</h2>
            <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">{empty.body}</p>
          </div>
        ) : (
          days.map((day) => (
            <section key={day.label}>
              <h2 className="sticky top-0 z-[2] border-b border-border-subtle bg-bg-main px-5 py-[9px] text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                {day.label}
              </h2>
              <ul>{day.rows.map((row) => row.node)}</ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}

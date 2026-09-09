import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Lock } from "lucide-react";
import { z } from "zod";
import { BookmarksBar } from "@/components/channel/bookmarks-bar";
import { ConnectionBanner } from "./connection-banner";
import { ChannelHeader } from "@/components/channel/channel-header";
import { UnarchiveButton } from "@/components/channel/archive-channel";
import { JoinLeaveButton } from "@/components/channel/join-leave-button";
import { MessagePane } from "@/components/message/message-pane";
import { PinsButton } from "@/components/pins/pins-button";
import { ContainerPanel } from "@/components/panel/container-panel";
import { ThreadPanel } from "@/components/thread/thread-panel";
import { HuddleBanner, HuddleButton } from "@/components/huddle/huddle-banner";
import { Button } from "@/components/ui/button";
import { reconcileHuddle } from "@/lib/actions/huddles";
import { getActiveHuddle } from "@/lib/queries/huddles";
import { getChannel, getChannelMembers, getMembership } from "@/lib/queries/channel";
import { fetchBookmarks } from "@/lib/queries/bookmarks";
import { fetchMessages, fetchPins } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ channelId: string }>;
type Search = Promise<{ thread?: string; panel?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { channelId } = await params;
  if (!z.string().uuid().safeParse(channelId).success) return {};
  const supabase = await createSupabaseServerClient();
  const channel = await getChannel(supabase, channelId);
  return { title: channel ? `#${channel.name}` : "Channel" };
}

/**
 * The composer's stand-in when a channel can be read but not posted to
 * (archived, or a public channel you're only previewing). Geometry from the
 * design's read-only composer: 34px icon tile, 13.5/600 reason, 12.5/1.5 body,
 * the way out inline on the right. The dashed 12px card around it is drawn by
 * MessagePane.
 */
function ReadOnlyNotice({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-[12px]">
      <span
        className="grid size-[34px] shrink-0 place-items-center rounded-lg border border-border-subtle bg-bg-card text-fg-600"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-[180px] flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="mt-[2px] block text-[12.5px] leading-[1.5] text-fg-600">{body}</span>
      </span>
      {action}
    </span>
  );
}

/**
 * A channel row that RLS won't hand over reads the same whether it's private or
 * gone, so we say the honest thing rather than leaking which. The design's
 * "no access" state: a 40px lock tile, 15.5/600 line, and the way onward.
 */
function NoChannelAccess() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-main px-5">
        <span className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Channel</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[24px] pb-[22px] pt-[18px] text-center">
        <span
          className="grid size-[40px] place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600"
          aria-hidden="true"
        >
          <Lock className="size-[17px]" />
        </span>
        <h1 className="mt-[12px] text-[15.5px] font-semibold tracking-[-0.015em] text-ink">
          You don&rsquo;t have access to this channel
        </h1>
        <p className="mt-[5px] max-w-[400px] text-pretty text-[13px] leading-[1.55] text-fg-600">
          It&rsquo;s private, or it isn&rsquo;t there any more. Any member who can see it can add you — until then it
          stays out of sight.
        </p>
        <Button asChild variant="outline" size="md" className="mt-[12px] px-[13px]">
          <Link href="/channels">Browse channels</Link>
        </Button>
      </div>
    </>
  );
}

export default async function ChannelPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ channelId }, { thread, panel }] = await Promise.all([params, searchParams]);
  const threadId = thread && z.string().uuid().safeParse(thread).success ? thread : null;
  const panelOpen = !threadId && (panel === "pins" || panel === "details");
  // A malformed id reads the same to the reader as one RLS won't hand over, and
  // the designed state says the honest thing; Next's stock 404 has no shell at all.
  if (!z.string().uuid().safeParse(channelId).success) return <NoChannelAccess />;

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const channel = await getChannel(supabase, channelId);
  if (!channel) return <NoChannelAccess />;

  const container = { kind: "channel" as const, id: channelId };
  const [membership, members, firstPage, rawHuddle, pins, bookmarks] = await Promise.all([
    getMembership(supabase, channelId, profile.id),
    getChannelMembers(supabase, channelId),
    fetchMessages(supabase, container),
    getActiveHuddle(supabase, container),
    fetchPins(supabase, container),
    fetchBookmarks(supabase, channelId),
  ]);
  const huddle = rawHuddle ? await reconcileHuddle(rawHuddle) : null;
  const huddleProps = { container, label: `#${channel.name}`, href: `/channel/${channel.id}`, initial: huddle, meId: profile.id };

  const me = { id: profile.id, display_name: profile.display_name, handle: profile.handle, avatar_url: profile.avatar_url };
  const canPost = membership !== null && !channel.is_archived;
  // The design's intro line is the channel's own words plus a nudge. Topic first,
  // because the topic is what the header shows — description would contradict it.
  const intro = channel.topic?.trim() || channel.description?.trim();
  const startBody = intro
    ? `${intro.replace(/[.!?]+$/, "")}. Post the first thing — half-finished is fine.`
    : "Everything the channel has ever said is below.";

  return (
    <>
      <ChannelHeader
        channel={channel}
        members={members}
        huddle={canPost ? <HuddleButton {...huddleProps} /> : undefined}
        pins={<PinsButton container={container} initialPins={pins} />}
      />
      <ConnectionBanner />
      <BookmarksBar channelId={channel.id} initialBookmarks={bookmarks} canEdit={(membership !== null || profile.role === "admin") && !channel.is_archived} />
      {canPost && <HuddleBanner {...huddleProps} />}
      <div className="flex min-h-0 flex-1">
      <MessagePane
        container={{ kind: "channel", id: channel.id }}
        me={me}
        isAdmin={profile.role === "admin"}
        canPost={canPost}
        lastReadAt={membership?.last_read_at ?? null}
        initialPage={firstPage}
        placeholder={`Message #${channel.name}`}
        startTitle={`This is the start of #${channel.name}`}
        startBody={startBody}
        readOnlyNotice={
          channel.is_archived ? (
            <ReadOnlyNotice
              icon={<Lock className="size-[16px]" />}
              title={<>#{channel.name} is archived</>}
              body="Everything here stays readable and searchable. Reopen it to post again."
              action={profile.role === "admin" ? <UnarchiveButton channelId={channel.id} channelName={channel.name} /> : undefined}
            />
          ) : (
            <ReadOnlyNotice
              icon={<Eye className="size-[16px]" />}
              title={<>You&rsquo;re previewing #{channel.name}</>}
              body="Read anything you like. Join to post, and it lands in your sidebar."
              action={<JoinLeaveButton channelId={channel.id} channelName={channel.name} joined={false} />}
            />
          )
        }
      />
      {threadId && (
        <ThreadPanel
          parentId={threadId}
          container={{ kind: "channel", id: channel.id }}
          containerLabel={`#${channel.name}`}
          me={me}
          isAdmin={profile.role === "admin"}
          canPost={canPost}
        />
      )}
      {panelOpen && (
        <ContainerPanel
          container={container}
          containerLabel={`#${channel.name}`}
          channel={channel}
          members={members}
          isMember={membership !== null}
          isAdmin={profile.role === "admin"}
          notificationLevel={(membership?.notification_level as "all" | "mentions" | "muted" | undefined) ?? null}
          me={me}
          initialPins={pins}
        />
      )}
      </div>
    </>
  );
}

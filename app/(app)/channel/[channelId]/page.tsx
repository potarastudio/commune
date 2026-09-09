import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChannelHeader } from "@/components/channel/channel-header";
import { JoinLeaveButton } from "@/components/channel/join-leave-button";
import { MessagePane } from "@/components/message/message-pane";
import { ThreadPanel } from "@/components/thread/thread-panel";
import { HuddleBanner, HuddleButton } from "@/components/huddle/huddle-banner";
import { reconcileHuddle } from "@/lib/actions/huddles";
import { getActiveHuddle } from "@/lib/queries/huddles";
import { getChannel, getChannelMembers, getMembership } from "@/lib/queries/channel";
import { fetchMessages } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ channelId: string }>;
type Search = Promise<{ thread?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { channelId } = await params;
  if (!z.string().uuid().safeParse(channelId).success) return {};
  const supabase = await createSupabaseServerClient();
  const channel = await getChannel(supabase, channelId);
  return { title: channel ? `#${channel.name}` : "Channel" };
}

export default async function ChannelPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ channelId }, { thread }] = await Promise.all([params, searchParams]);
  const threadId = thread && z.string().uuid().safeParse(thread).success ? thread : null;
  if (!z.string().uuid().safeParse(channelId).success) notFound();

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const channel = await getChannel(supabase, channelId);
  if (!channel) notFound();

  const container = { kind: "channel" as const, id: channelId };
  const [membership, members, firstPage, rawHuddle] = await Promise.all([
    getMembership(supabase, channelId, profile.id),
    getChannelMembers(supabase, channelId),
    fetchMessages(supabase, container),
    getActiveHuddle(supabase, container),
  ]);
  const huddle = rawHuddle ? await reconcileHuddle(rawHuddle) : null;
  const huddleProps = { container, label: `#${channel.name}`, href: `/channel/${channel.id}`, initial: huddle, meId: profile.id };

  const me = { id: profile.id, display_name: profile.display_name, handle: profile.handle, avatar_url: profile.avatar_url };
  const canPost = membership !== null && !channel.is_archived;

  return (
    <>
      <ChannelHeader
        channel={channel}
        members={members}
        isMember={membership !== null}
        isAdmin={profile.role === "admin"}
        notificationLevel={(membership?.notification_level as "all" | "mentions" | "muted" | undefined) ?? null}
        huddle={canPost ? <HuddleButton {...huddleProps} /> : undefined}
      />
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
        startBody="Everything the channel has ever said is below."
        readOnlyNotice={
          channel.is_archived ? (
            <span>
              <strong>#{channel.name}</strong> is archived. You can read it, but nobody can post.
            </span>
          ) : (
            <span className="flex items-center justify-between gap-3">
              <span>
                You&apos;re previewing <strong>#{channel.name}</strong>. Join to post.
              </span>
              <JoinLeaveButton channelId={channel.id} channelName={channel.name} joined={false} />
            </span>
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
      </div>
    </>
  );
}

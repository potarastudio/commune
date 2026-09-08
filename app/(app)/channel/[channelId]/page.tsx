import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChannelHeader } from "@/components/channel/channel-header";
import { ChannelView } from "@/components/channel/channel-view";
import { getChannel, getMemberCount, getMembership } from "@/lib/queries/channel";
import { fetchChannelMessages } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ channelId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { channelId } = await params;
  if (!z.string().uuid().safeParse(channelId).success) return {};
  const supabase = await createSupabaseServerClient();
  const channel = await getChannel(supabase, channelId);
  return { title: channel ? `#${channel.name}` : "Channel" };
}

export default async function ChannelPage({ params }: { params: Params }) {
  const { channelId } = await params;
  if (!z.string().uuid().safeParse(channelId).success) notFound();

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const channel = await getChannel(supabase, channelId);
  if (!channel) notFound();

  const [membership, memberCount, firstPage] = await Promise.all([
    getMembership(supabase, channelId, profile.id),
    getMemberCount(supabase, channelId),
    fetchChannelMessages(supabase, channelId),
  ]);

  return (
    <>
      <ChannelHeader channel={channel} memberCount={memberCount} />
      <ChannelView
        channel={channel}
        me={{ id: profile.id, display_name: profile.display_name, handle: profile.handle, avatar_url: profile.avatar_url }}
        isAdmin={profile.role === "admin"}
        isMember={membership !== null}
        lastReadAt={membership?.last_read_at ?? null}
        initialPage={firstPage}
      />
    </>
  );
}

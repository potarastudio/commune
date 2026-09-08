import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DmHeader } from "@/components/dm/dm-header";
import { MessagePane } from "@/components/message/message-pane";
import { conversationLabel, conversationMembership, getConversation } from "@/lib/queries/conversations";
import { fetchMessages } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ conversationId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { conversationId } = await params;
  if (!z.string().uuid().safeParse(conversationId).success) return {};
  const supabase = await createSupabaseServerClient();
  const [profile, conversation] = await Promise.all([getCurrentProfile(supabase), getConversation(supabase, conversationId)]);
  return { title: conversation && profile ? conversationLabel(conversation.members, profile.id) : "Direct message" };
}

export default async function ConversationPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  if (!z.string().uuid().safeParse(conversationId).success) notFound();

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const conversation = await getConversation(supabase, conversationId);
  if (!conversation) notFound();

  const [{ data: membership }, firstPage] = await Promise.all([
    conversationMembership(supabase, conversationId, profile.id),
    fetchMessages(supabase, { kind: "conversation", id: conversationId }),
  ]);

  const label = conversationLabel(conversation.members, profile.id);
  const others = conversation.members.filter((m) => m.id !== profile.id);

  return (
    <>
      <DmHeader members={conversation.members} meId={profile.id} />
      <MessagePane
        container={{ kind: "conversation", id: conversation.id }}
        me={{ id: profile.id, display_name: profile.display_name, handle: profile.handle, avatar_url: profile.avatar_url }}
        isAdmin={profile.role === "admin"}
        canPost={membership !== null}
        lastReadAt={membership?.last_read_at ?? null}
        initialPage={firstPage}
        placeholder={`Message ${conversationLabel(conversation.members, profile.id, { short: true })}`}
        startTitle={
          others.length === 0
            ? "This is your space."
            : others.length === 1
              ? `This is the start of your conversation with ${label}.`
              : `This is the start of your group with ${label}.`
        }
        startBody={others.length === 0 ? "Notes to yourself. Nobody else can see this." : "Everything you have said to each other is below."}
        readOnlyNotice={<span>You&apos;re not part of this conversation.</span>}
      />
    </>
  );
}

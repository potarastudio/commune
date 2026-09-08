import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DmHeader } from "@/components/dm/dm-header";
import { MessagePane } from "@/components/message/message-pane";
import { ThreadPanel } from "@/components/thread/thread-panel";
import { conversationLabel, conversationMembership, getConversation } from "@/lib/queries/conversations";
import { fetchMessages } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = Promise<{ conversationId: string }>;
type Search = Promise<{ thread?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { conversationId } = await params;
  if (!z.string().uuid().safeParse(conversationId).success) return {};
  const supabase = await createSupabaseServerClient();
  const [profile, conversation] = await Promise.all([getCurrentProfile(supabase), getConversation(supabase, conversationId)]);
  return { title: conversation && profile ? conversationLabel(conversation.members, profile.id) : "Direct message" };
}

export default async function ConversationPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ conversationId }, { thread }] = await Promise.all([params, searchParams]);
  const threadId = thread && z.string().uuid().safeParse(thread).success ? thread : null;
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
  const shortLabel = conversationLabel(conversation.members, profile.id, { short: true });
  const others = conversation.members.filter((m) => m.id !== profile.id);
  const me = { id: profile.id, display_name: profile.display_name, handle: profile.handle, avatar_url: profile.avatar_url };

  return (
    <>
      <DmHeader members={conversation.members} meId={profile.id} />
      <div className="flex min-h-0 flex-1">
      <MessagePane
        container={{ kind: "conversation", id: conversation.id }}
        me={me}
        isAdmin={profile.role === "admin"}
        canPost={membership !== null}
        lastReadAt={membership?.last_read_at ?? null}
        initialPage={firstPage}
        placeholder={`Message ${shortLabel}`}
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
      {threadId && (
        <ThreadPanel
          parentId={threadId}
          container={{ kind: "conversation", id: conversation.id }}
          containerLabel={shortLabel}
          me={me}
          isAdmin={profile.role === "admin"}
          canPost={membership !== null}
        />
      )}
      </div>
    </>
  );
}

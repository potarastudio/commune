import { redirect } from "next/navigation";
import { PresenceProvider } from "@/components/presence/presence-provider";
import { CommandPalette } from "@/components/search/command-palette";
import { Sidebar } from "@/components/sidebar/sidebar";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getMyConversations } from "@/lib/queries/conversations";
import { getCurrentProfile } from "@/lib/queries/profile";
import { toUnreadMap } from "@/lib/utils/unreads";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (!profile.onboarded_at) redirect("/welcome");

  const [channels, conversations, unreadRows] = await Promise.all([
    getJoinedChannels(supabase, profile.id),
    getMyConversations(supabase),
    supabase.rpc("get_unread_counts").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data;
    }),
  ]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar profile={profile} channels={channels} conversations={conversations} unreads={toUnreadMap(unreadRows)} />
      <main className="flex min-w-0 flex-1 flex-col bg-background">{children}</main>
      <CommandPalette meId={profile.id} joinedChannelIds={channels.map((c) => c.id)} />
      <PresenceProvider meId={profile.id} />
    </div>
  );
}

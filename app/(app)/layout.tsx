import { redirect } from "next/navigation";
import { HuddleProvider } from "@/components/huddle/huddle-provider";
import { MobileShell } from "@/components/mobile/mobile-shell";
import { Notifier } from "@/components/notifications/notifier";
import { PresenceProvider } from "@/components/presence/presence-provider";
import { CommandPalette } from "@/components/search/command-palette";
import { KeyboardShortcuts } from "@/components/shortcuts/keyboard-shortcuts";
import { ChannelColumn } from "@/components/sidebar/channel-column";
import { Sidebar, WorkspaceRail } from "@/components/sidebar/sidebar";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getMyConversations } from "@/lib/queries/conversations";
import { getCurrentProfile } from "@/lib/queries/profile";
import { toUnreadMap } from "@/lib/utils/unreads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MobileProvider } from "@/lib/mobile-context";
import { isMobileRequest } from "@/lib/mobile-server";
import { ViewerTimezoneProvider } from "@/lib/viewer-timezone";

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
  const unreads = toUnreadMap(unreadRows);
  const notifier = (
    <Notifier
      meId={profile.id}
      channels={channels.map((c) => ({ id: c.id, name: c.name, level: c.notification_level }))}
      dnd={{ dnd_start: profile.dnd_start, dnd_end: profile.dnd_end, timezone: profile.timezone }}
    />
  );

  // Phones get their own shell (design: Commune Mobile Navigation): tab stacks,
  // pushed screens, no sidebar, no command palette or keyboard shortcuts.
  if (await isMobileRequest()) {
    return (
      <MobileProvider mobile>
        <ViewerTimezoneProvider timezone={profile.timezone}>
          <HuddleProvider>
            <MobileShell
              me={{ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url }}
              initialUnreads={unreads}
              mutedChannelIds={channels.filter((c) => c.notification_level === "muted").map((c) => c.id)}
            >
              {children}
            </MobileShell>
            <PresenceProvider meId={profile.id} />
            {notifier}
          </HuddleProvider>
        </ViewerTimezoneProvider>
      </MobileProvider>
    );
  }

  return (
    <MobileProvider mobile={false}>
    <ViewerTimezoneProvider timezone={profile.timezone}>
    <HuddleProvider>
    {/* Between 900px and 768px the channel column drops out (see Sidebar) and the
        conversation takes the width; below 768px the page scrolls sideways instead. */}
    <div className="h-dvh overflow-auto bg-bg-main">
      <div className="flex h-full min-h-0 min-w-[768px] overflow-hidden">
        <WorkspaceRail profile={profile} channels={channels} initialUnreads={unreads} />
        <ChannelColumn>
          <Sidebar profile={profile} channels={channels} conversations={conversations} unreads={unreads} />
        </ChannelColumn>
        <main className="flex min-w-0 flex-1 flex-col bg-bg-main">{children}</main>
        <CommandPalette meId={profile.id} joinedChannelIds={channels.map((c) => c.id)} />
        <KeyboardShortcuts
          items={[
            ...channels.map((c) => ({ href: `/channel/${c.id}`, key: `channel:${c.id}` })),
            ...conversations.map((c) => ({ href: `/dm/${c.id}`, key: `conversation:${c.id}` })),
          ]}
        />
        <PresenceProvider meId={profile.id} />
        {notifier}
      </div>
    </div>
    </HuddleProvider>
    </ViewerTimezoneProvider>
    </MobileProvider>
  );
}

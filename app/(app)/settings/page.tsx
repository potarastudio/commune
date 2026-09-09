import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hash, Lock } from "lucide-react";
import { NotificationLevelControl } from "@/components/channel/notification-level";
import { ProfileForm } from "@/components/profile/profile-form";
import { InvitePeople } from "@/components/settings/invite-people";
import { NotificationSettings } from "@/components/settings/notifications";
import { ThemePicker } from "@/components/settings/theme-picker";
import { getInvites } from "@/lib/queries/invites";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  const [channels, invites] = await Promise.all([
    getJoinedChannels(supabase, profile.id),
    profile.role === "admin" ? getInvites(supabase) : Promise.resolve([]),
  ]);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <section className="mx-auto w-full max-w-lg px-6 py-8">
          <h2 className="text-[16px] font-semibold tracking-tight">Profile</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Your name, handle and photo across Commune.</p>
          <div className="mt-6">
            <ProfileForm profile={profile} mode="settings" />
          </div>
        </section>

        {profile.role === "admin" && (
          <section className="mx-auto w-full max-w-lg border-t border-border px-6 py-8">
            <h2 className="text-[16px] font-semibold tracking-tight">Invite people</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Anyone you add can sign in with Google using that exact address. They get an email with a link. Admins can also change roles here.
            </p>
            <div className="mt-4">
              <InvitePeople invites={invites} meId={profile.id} />
            </div>
          </section>
        )}

        <section className="mx-auto w-full max-w-lg border-t border-border px-6 py-8">
          <h2 className="text-[16px] font-semibold tracking-tight">Appearance</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Light and dark are both first-class. System follows your OS.</p>
          <div className="mt-4">
            <ThemePicker />
          </div>
        </section>

        <section className="mx-auto w-full max-w-lg border-t border-border px-6 py-8">
          <h2 className="text-[16px] font-semibold tracking-tight">Notifications</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Direct messages and mentions can reach you even when Commune isn&apos;t in front, or isn&apos;t open at all.</p>
          <div className="mt-4">
            <NotificationSettings
              dndStart={profile.dnd_start}
              dndEnd={profile.dnd_end}
              timezone={profile.timezone}
              email={profile.email}
              emailDigest={profile.email_digest}
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-lg border-t border-border px-6 py-8">
          <h2 className="text-[16px] font-semibold tracking-tight">Channel notifications</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            What counts as unread in the sidebar. Mentions always include @you, @channel and @here.
          </p>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                {c.is_private ? (
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-[14px]">{c.name}</span>
                <div className="w-56">
                  <NotificationLevelControl channelId={c.id} level={c.notification_level} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

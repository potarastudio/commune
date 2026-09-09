import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Hash, Lock } from "lucide-react";
import { signOut } from "@/app/(app)/actions";
import { NotificationLevelControl } from "@/components/channel/notification-level";
import { ProfileForm } from "@/components/profile/profile-form";
import { CustomEmojiSettings } from "@/components/settings/custom-emoji";
import { InvitePeople } from "@/components/settings/invite-people";
import { NotificationSettings } from "@/components/settings/notifications";
import { ThemePicker } from "@/components/settings/theme-picker";
import { getInvites } from "@/lib/queries/invites";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

/**
 * One settings section: an 11.5/700 caps overline, an optional 12.5px
 * description, then the controls. The design separates sections with air and a
 * card around the rows rather than a rule, so the rhythm is overline → card.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pb-[22px]">
      <h2 className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{title}</h2>
      {description ? <p className="mt-[6px] text-[12.5px] leading-[1.5] text-fg-600">{description}</p> : null}
      <div className="mt-[9px]">{children}</div>
    </section>
  );
}

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
      {/* 56px, so the hairline lines up with every other view header. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-main px-6">
        <span className="min-w-0 flex-1">
          <h1 className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">Settings</h1>
          <span className="block truncate text-[12px] text-muted-foreground">
            How you appear, what reaches you, and how Commune looks
          </span>
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
        <div className="w-full max-w-[620px]">
          <Section title="Profile">
            <ProfileForm profile={profile} mode="settings" />
          </Section>

          <Section
            title="Notifications"
            description="Direct messages and mentions can reach you even when Commune isn't in front, or isn't open at all."
          >
            <NotificationSettings
              dndStart={profile.dnd_start}
              dndEnd={profile.dnd_end}
              timezone={profile.timezone}
              email={profile.email}
              emailDigest={profile.email_digest}
            />
          </Section>

          <Section
            title="Channel notifications"
            description="What counts as unread in the sidebar. Mentions always include @you, @channel and @here."
          >
            <div className="overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs">
              <ul className="divide-y divide-border-subtle">
                {channels.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-[10px]">
                    {c.is_private ? (
                      <Lock className="size-[15px] shrink-0 text-tertiary" aria-hidden="true" />
                    ) : (
                      <Hash className="size-[15px] shrink-0 text-tertiary" aria-hidden="true" />
                    )}
                    <span className="min-w-[120px] flex-1 truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                    <div className="w-[292px] shrink-0">
                      <NotificationLevelControl channelId={c.id} level={c.notification_level} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          <Section title="Appearance" description="Light and dark are both first-class. System follows your OS.">
            <ThemePicker />
          </Section>

          {profile.role === "admin" && (
            <Section
              title="Members"
              description="Anyone you add can sign in with Google using that exact address. They get an email with a link. Admins can also change roles here."
            >
              <InvitePeople invites={invites} meId={profile.id} />
            </Section>
          )}

          <Section
            title="Custom emoji"
            description={
              <>
                The studio&apos;s own emoji, for messages and reactions. Type{" "}
                <code className="rounded-sm border border-border-subtle bg-bg-code px-1 font-mono text-[12px] text-body">:name:</code> or pick
                them from the emoji picker.
                {profile.role === "admin" ? " As an admin you can remove any of them." : " You can remove the ones you added."}
              </>
            }
          >
            <CustomEmojiSettings meId={profile.id} isAdmin={profile.role === "admin"} />
          </Section>

          <Section title="Account" description="How you get into Commune.">
            <div className="overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs">
              <div className="divide-y divide-border-subtle">
                <div className="flex flex-wrap items-center gap-4 px-4 py-[14px]">
                  <span className="min-w-[180px] flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">Email</span>
                    <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">
                      Used for sign-in and the mention digest.
                    </span>
                  </span>
                  <span className="flex h-[34px] w-[260px] max-w-full shrink-0 items-center rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13.5px] text-body shadow-xs">
                    <span className="min-w-0 truncate">{profile.email}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 px-4 py-[14px]">
                  <span className="min-w-[180px] flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">Google account</span>
                    <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">
                      Connected — Google is the only way into Commune.
                    </span>
                  </span>
                  <span className="flex h-[34px] shrink-0 items-center gap-[7px] rounded-[8px] border border-border bg-bg-chip px-[11px] text-[12.5px] font-semibold text-fg-600">
                    <Check className="size-[13px] text-presence" aria-hidden="true" />
                    Connected
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <section className="pb-[22px]">
            <h2 className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Danger zone</h2>
            <div className="mt-[9px] overflow-hidden rounded-[12px] border border-danger bg-bg-card">
              <div className="flex flex-wrap items-center gap-4 px-4 py-[14px]">
                <span className="min-w-[180px] flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">Sign out</span>
                  <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">
                    Ends this session in this browser. Your messages stay in the channels they were posted in — they are the studio&apos;s
                    record, not yours alone.
                  </span>
                </span>
                <form action={signOut} className="shrink-0">
                  <button
                    type="submit"
                    className="flex h-[32px] items-center rounded-[8px] border border-danger bg-danger-surface px-[11px] text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/15"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

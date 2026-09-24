import { Check, Hash, Lock } from "lucide-react";
import { NotificationLevelControl } from "@/components/channel/notification-level";
import { ProfileForm } from "@/components/profile/profile-form";
import { CustomEmojiSettings } from "@/components/settings/custom-emoji";
import { InvitePeople } from "@/components/settings/invite-people";
import { NotificationSettings, NotifyAbout } from "@/components/settings/notifications";
import { ThemePicker } from "@/components/settings/theme-picker";
import type { JoinedChannel } from "@/lib/queries/channels";
import type { getInvites } from "@/lib/queries/invites";
import type { Profile } from "@/lib/queries/profile";
import { PushedHeader } from "./screen-header";
import { SettingsGroup } from "./you-screen";

export type MobileSettingsSection = "profile" | "notifications" | "appearance" | "members" | "account";

const TITLES: Record<MobileSettingsSection, string> = {
  profile: "Profile",
  notifications: "Notifications",
  appearance: "Appearance",
  members: "Members",
  account: "Account",
};

/** A group's explanatory line, under the card rather than inside it. */
function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="mx-[16px] mt-[8px] text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{children}</p>;
}

/**
 * A settings screen pushed from You (design: Mobile Core Screens →
 * Notifications): a real back label, then grouped cards. The controls are the
 * desktop's own — the same actions, the same rules — drawn at the phone's size.
 */
export function MobileSettingsScreen({
  section,
  profile,
  isAdmin,
  channels,
  invites,
  signOutHere,
  signOutEverywhere,
}: {
  section: MobileSettingsSection;
  profile: Profile;
  isAdmin: boolean;
  channels: JoinedChannel[];
  invites: Awaited<ReturnType<typeof getInvites>>;
  signOutHere: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
}) {
  return (
    <>
      <PushedHeader title={TITLES[section]} backLabel="Back to You" />

      {/* Profile owns its scroll area, since its save footer sits under it. */}
      {section === "profile" ? (
        <ProfileForm profile={profile} mode="settings" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg-main pt-[16px] pb-[calc(20px+var(--safe-bottom))]">
          {section === "notifications" && (
            <>
              <SettingsGroup title="Notify me about">
                <NotifyAbout channels={channels} variant="mobile" handle={profile.handle} />
              </SettingsGroup>
              <NotificationSettings
                variant="mobile"
                dndStart={profile.dnd_start}
                dndEnd={profile.dnd_end}
                timezone={profile.timezone}
                email={profile.email}
                emailDigest={profile.email_digest}
              />
              {channels.length > 0 && (
                <>
                  <SettingsGroup title="Channels" className="mt-[16px]">
                    <ul>
                      {channels.map((c) => (
                        <li key={c.id} className="border-t border-border-subtle px-[16px] py-[12px]">
                          <span className="flex items-center gap-[7px] text-[14.5px] font-medium text-ink">
                            {c.is_private ? (
                              <Lock className="size-[14px] shrink-0 text-tertiary" aria-hidden="true" />
                            ) : (
                              <Hash className="size-[14px] shrink-0 text-tertiary" aria-hidden="true" />
                            )}
                            <span className="min-w-0 truncate">{c.name}</span>
                          </span>
                          <div className="mt-[9px]">
                            <NotificationLevelControl channelId={c.id} level={c.notification_level} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </SettingsGroup>
                  <Footnote>Mentions always include @you, @channel and @here.</Footnote>
                </>
              )}
            </>
          )}

          {section === "appearance" && (
            <>
              <SettingsGroup title="Theme">
                <div className="border-t border-border-subtle p-[12px]">
                  <ThemePicker />
                </div>
              </SettingsGroup>
              <Footnote>Light and dark are both first-class. System follows your phone.</Footnote>
              <SettingsGroup title="Custom emoji" className="mt-[16px]">
                <div className="border-t border-border-subtle p-[12px]">
                  <CustomEmojiSettings meId={profile.id} isAdmin={isAdmin} />
                </div>
              </SettingsGroup>
              <Footnote>The studio&rsquo;s own emoji, for messages and reactions. Type :name: or pick them from the emoji sheet.</Footnote>
            </>
          )}

          {section === "members" && isAdmin && (
            <>
              <SettingsGroup title="Invite">
                <div className="border-t border-border-subtle p-[12px]">
                  <InvitePeople invites={invites} meId={profile.id} />
                </div>
              </SettingsGroup>
              <Footnote>Anyone you add can sign in with Google using that exact address. They get an email with a link.</Footnote>
            </>
          )}

          {section === "account" && (
            <>
              <SettingsGroup title="Sign in">
                <div className="border-t border-border-subtle px-[16px] py-[13px]">
                  <span className="block text-[14.5px] font-medium text-ink">Email</span>
                  <span className="mt-[3px] block truncate text-[13.5px] text-fg-600">{profile.email}</span>
                </div>
                <div className="flex items-center gap-[12px] border-t border-border-subtle px-[16px] py-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-ink">Google account</span>
                    <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">Sign in with Google, or a one-time link by email.</span>
                  </span>
                  <span className="flex h-[32px] shrink-0 items-center gap-[6px] rounded-[8px] border border-border bg-bg-chip px-[10px] text-[12.5px] font-semibold text-fg-600">
                    <Check className="size-[13px] text-presence" aria-hidden="true" />
                    Connected
                  </span>
                </div>
              </SettingsGroup>

              <SettingsGroup title="Danger zone" className="mt-[16px] border-danger">
                <form action={signOutHere} className="border-t border-border-subtle px-[16px] py-[13px]">
                  <span className="block text-[14.5px] font-medium text-ink">Sign out</span>
                  <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">
                    Ends this session on this phone. Your messages stay where they were posted.
                  </span>
                  <button
                    type="submit"
                    className="mt-[12px] flex h-[44px] w-full items-center justify-center rounded-[11px] border border-danger bg-danger-surface text-[14px] font-semibold text-danger"
                  >
                    Sign out
                  </button>
                </form>
                <form action={signOutEverywhere} className="border-t border-border-subtle px-[16px] py-[13px]">
                  <span className="block text-[14.5px] font-medium text-ink">Sign out everywhere</span>
                  <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">
                    Ends every session, including this one — every browser, computer and phone.
                  </span>
                  <button
                    type="submit"
                    className="mt-[12px] flex h-[44px] w-full items-center justify-center rounded-[11px] border border-danger bg-danger text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  >
                    Sign out all
                  </button>
                </form>
              </SettingsGroup>
            </>
          )}
        </div>
      )}
    </>
  );
}

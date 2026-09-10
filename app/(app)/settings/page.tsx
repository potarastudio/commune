import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AtSign, Check, ChevronLeft, Hash, Lock, Settings as SettingsIcon, Sun, Users } from "lucide-react";
import { NotificationLevelControl } from "@/components/channel/notification-level";
import { ProfileForm } from "@/components/profile/profile-form";
import { CustomEmojiSettings } from "@/components/settings/custom-emoji";
import { InvitePeople } from "@/components/settings/invite-people";
import { NotificationSettings, NotifyAbout } from "@/components/settings/notifications";
import { ThemePicker } from "@/components/settings/theme-picker";
import { getInvites } from "@/lib/queries/invites";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings is its own surface: the 248px column below replaces the channel
 * list, and each of its five entries is a page with its own 56px header and,
 * where there is something to save, the pane's own sticky footer.
 *
 * The section lives in the URL (`/settings?section=notifications`) so every
 * entry is a real link — back/forward, open-in-new-tab and the keyboard all
 * work without a line of client state.
 */
const SECTIONS = [
  { value: "profile", label: "Profile", icon: SettingsIcon },
  { value: "notifications", label: "Notifications", icon: AtSign },
  { value: "appearance", label: "Appearance", icon: Sun },
  { value: "members", label: "Members", icon: Users },
  { value: "account", label: "Account", icon: Lock },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

const OVERLINE = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground";

function SettingsColumn({ current, isAdmin }: { current: Section; isAdmin: boolean }) {
  return (
    <aside aria-label="Settings" className="flex w-[248px] shrink-0 flex-col border-r border-border bg-bg-col">
      {/* 56px, so its baseline matches the section header across the hairline. */}
      <div className="flex h-14 shrink-0 items-center gap-[9px] px-4">
        <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">Settings</span>
      </div>

      <nav aria-label="Settings sections" className="flex flex-1 flex-col gap-px overflow-y-auto px-2 pt-1 pb-4">
        {SECTIONS.filter((s) => s.value !== "members" || isAdmin).map((s) => {
          const active = s.value === current;
          return (
            <Link
              key={s.value}
              href={`/settings?section=${s.value}`}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 items-center gap-[10px] rounded-[8px] text-[13.5px] transition-colors ${
                active
                  ? "border border-border-strong bg-bg-card px-[9px] font-semibold text-ink shadow-xs"
                  : "px-[10px] text-fg-500 hover:bg-bg-hover hover:text-ink"
              }`}
            >
              <s.icon className={`size-[15px] shrink-0 ${active ? "text-primary" : "text-tertiary"}`} aria-hidden="true" />
              {s.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-[12.5px] font-semibold text-fg-600 transition-colors hover:text-ink"
        >
          <ChevronLeft className="size-[14px]" aria-hidden="true" />
          Back to Commune
        </Link>
      </div>
    </aside>
  );
}

/** A section's header: 56px, title over subtitle, sitting on the same hairline as the column's. */
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-main px-6">
      <span className="min-w-0 flex-1">
        <h1 className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        <span className="block truncate text-[12px] text-muted-foreground">{subtitle}</span>
      </span>
    </header>
  );
}

/**
 * One card in a section: an 11.5/700 caps overline, an optional 12.5px
 * description, then the controls. The rhythm is overline → card, with 22px
 * between sections; two cards never stack without a break between them.
 */
function Card({
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
      <h2 className={OVERLINE}>{title}</h2>
      {description ? <p className="mt-[6px] text-[12.5px] leading-[1.5] text-fg-600">{description}</p> : null}
      <div className="mt-[9px]">{children}</div>
    </section>
  );
}

/** The scroll region every section but Profile uses — Profile owns its own, since its save footer sits under it. */
function Pane({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 pt-5 pb-2">
      <div className="max-w-[620px]">{children}</div>
    </div>
  );
}

const ROW = "flex flex-wrap items-center gap-4 px-4 py-[14px]";
const ROW_LABEL = "block text-[13.5px] font-semibold text-ink";
const ROW_NOTE = "mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600";
const CARD = "overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  const isAdmin = profile.role === "admin";

  const asked = (await searchParams).section;
  const wanted = Array.isArray(asked) ? asked[0] : asked;
  const section: Section = SECTIONS.some((s) => s.value === wanted) ? (wanted as Section) : "profile";
  // Members is the allowlist, which RLS makes admin-only; it is not in the nav for anyone else either.
  if (section === "members" && !isAdmin) redirect("/settings");

  const [channels, invites] = await Promise.all([
    getJoinedChannels(supabase, profile.id),
    isAdmin ? getInvites(supabase) : Promise.resolve([]),
  ]);
  const joined = invites.filter((i) => i.profile).length;
  const waiting = invites.length - joined;

  /**
   * Two rows, two scopes. `supabase.auth.signOut()` defaults to the GLOBAL
   * scope, so both would end every session unless this one is explicit — which
   * would have made "Sign out everywhere" a second button doing the same thing.
   */
  async function signOutHere() {
    "use server";
    const client = await createSupabaseServerClient();
    await client.auth.signOut({ scope: "local" });
    redirect("/login");
  }

  async function signOutEverywhere() {
    "use server";
    const client = await createSupabaseServerClient();
    await client.auth.signOut({ scope: "global" });
    redirect("/login");
  }

  return (
    <div className="flex min-h-0 flex-1">
      <SettingsColumn current={section} isAdmin={isAdmin} />

      <div className="flex min-w-0 flex-1 flex-col">
        {section === "profile" && (
          <>
            <SectionHeader title="Profile" subtitle="How you appear across Commune" />
            <ProfileForm profile={profile} mode="settings" />
          </>
        )}

        {section === "notifications" && (
          <>
            <SectionHeader title="Notifications" subtitle="What reaches you, and when" />
            <Pane>
              <Card
                title="Notify me about"
                description="Applies to every channel you have joined. Direct messages always reach you."
              >
                <NotifyAbout channels={channels} />
              </Card>

              <Card
                title="Delivery"
                description="Direct messages and mentions can reach you even when Commune isn't in front, or isn't open at all."
              >
                <NotificationSettings
                  dndStart={profile.dnd_start}
                  dndEnd={profile.dnd_end}
                  timezone={profile.timezone}
                  email={profile.email}
                  emailDigest={profile.email_digest}
                />
              </Card>

              <Card
                title="Channels"
                description="What counts as unread in the sidebar, one channel at a time. Mentions always include @you, @channel and @here."
              >
                <div className={CARD}>
                  <ul className="divide-y divide-border-subtle">
                    {channels.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-[10px]">
                        {c.is_private ? (
                          <Lock className="size-[15px] shrink-0 text-tertiary" aria-hidden="true" />
                        ) : (
                          <Hash className="size-[15px] shrink-0 text-tertiary" aria-hidden="true" />
                        )}
                        <span className="min-w-[120px] flex-1 truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                        <div className="w-[292px] max-w-full shrink-0">
                          <NotificationLevelControl channelId={c.id} level={c.notification_level} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </Pane>
          </>
        )}

        {section === "appearance" && (
          <>
            <SectionHeader title="Appearance" subtitle="Theme and the studio's own emoji" />
            <Pane>
              <Card title="Theme" description="Light and dark are both first-class. System follows your OS.">
                <ThemePicker />
              </Card>

              <Card
                title="Custom emoji"
                description={
                  <>
                    The studio&apos;s own emoji, for messages and reactions. Type{" "}
                    <code className="rounded-sm border border-border-subtle bg-bg-code px-1 font-mono text-[12px] text-body">
                      :name:
                    </code>{" "}
                    or pick them from the emoji picker.
                    {isAdmin ? " As an admin you can remove any of them." : " You can remove the ones you added."}
                  </>
                }
              >
                <CustomEmojiSettings meId={profile.id} isAdmin={isAdmin} />
              </Card>
            </Pane>
          </>
        )}

        {section === "members" && (
          <>
            <SectionHeader
              title="Members"
              subtitle={`${joined} ${joined === 1 ? "person" : "people"} · ${waiting} pending invite${waiting === 1 ? "" : "s"}`}
            />
            <Pane>
              <Card
                title="Invite"
                description="Anyone you add can sign in with Google using that exact address. They get an email with a link. Admins can also change roles here."
              >
                <InvitePeople invites={invites} meId={profile.id} />
              </Card>
            </Pane>
          </>
        )}

        {section === "account" && (
          <>
            <SectionHeader title="Account" subtitle="Sign-in and security" />
            <Pane>
              <Card title="Sign in" description="How you get into Commune.">
                <div className={CARD}>
                  <div className="divide-y divide-border-subtle">
                    <div className={ROW}>
                      <span className="min-w-[180px] flex-1">
                        <span className={ROW_LABEL}>Email</span>
                        <span className={ROW_NOTE}>Used for sign-in and the mention digest.</span>
                      </span>
                      <span className="flex h-[34px] w-[260px] max-w-full shrink-0 items-center rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13.5px] text-body shadow-xs">
                        <span className="min-w-0 truncate">{profile.email}</span>
                      </span>
                    </div>
                    <div className={ROW}>
                      <span className="min-w-[180px] flex-1">
                        <span className={ROW_LABEL}>Google account</span>
                        <span className={ROW_NOTE}>Sign in with Google, or ask for a one-time link by email.</span>
                      </span>
                      <span className="flex h-[34px] shrink-0 items-center gap-[7px] rounded-[8px] border border-border bg-bg-chip px-[11px] text-[12.5px] font-semibold text-fg-600">
                        <Check className="size-[13px] text-presence" aria-hidden="true" />
                        Connected
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <section className="pb-[22px]">
                <h2 className={OVERLINE}>Danger zone</h2>
                <div className="mt-[9px] overflow-hidden rounded-[12px] border border-danger bg-bg-card">
                  <div className="divide-y divide-border-subtle">
                    <div className={ROW}>
                      <span className="min-w-[180px] flex-1">
                        <span className={ROW_LABEL}>Sign out</span>
                        <span className={ROW_NOTE}>
                          Ends this session in this browser. Your messages stay in the channels they were posted in — they are
                          the studio&apos;s record, not yours alone.
                        </span>
                      </span>
                      <form action={signOutHere} className="shrink-0">
                        <button
                          type="submit"
                          className="flex h-[32px] items-center rounded-[8px] border border-danger bg-danger-surface px-[11px] text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/15"
                        >
                          Sign out
                        </button>
                      </form>
                    </div>

                    <div className={ROW}>
                      <span className="min-w-[180px] flex-1">
                        <span className={ROW_LABEL}>Sign out everywhere</span>
                        <span className={ROW_NOTE}>
                          Ends every session including this one — every browser and every device. You sign back in with Google.
                        </span>
                      </span>
                      <form action={signOutEverywhere} className="shrink-0">
                        <button
                          type="submit"
                          className="flex h-[32px] items-center rounded-[8px] border border-danger bg-danger px-[11px] text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-[filter] hover:brightness-95"
                        >
                          Sign out all
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </section>
            </Pane>
          </>
        )}
      </div>
    </div>
  );
}

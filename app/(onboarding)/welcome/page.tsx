import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import { ProfileForm } from "@/components/profile/profile-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your profile" };

/** Two missed 60s heartbeats (components/presence/presence-provider) still counts as here. */
const ONLINE_WINDOW_MS = 150_000;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const inWords = (n: number) => WORDS[n] ?? n.toLocaleString("en-US");

/** "Hakim, Sari, Raka and nine others." — the design's phrasing, for any team size. */
function peopleLine(names: string[], overflow: number) {
  if (overflow > 0) return `${names.join(", ")} and ${inWords(overflow)} other${overflow === 1 ? "" : "s"}.`;
  if (names.length > 1) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
  return `${names[0]}.`;
}

/**
 * First run: confirm name, handle and photo before entering the workspace.
 * Chrome follows the setup design's "Invited" artboard — a 540px column on the
 * channel-column ground, no step counter, because profile setup is the only
 * step this app has. The card above the form is the artboard's welcome: who is
 * already here, and how much of the studio is readable from day one.
 */
export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/");

  const firstName = profile.display_name.split(" ")[0];

  // RLS scopes all three to what this account may actually see.
  const [team, publicChannels, myChannels, readableMessages] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, last_seen_at")
      .neq("id", profile.id)
      .order("created_at"),
    supabase.from("channels").select("id", { count: "exact", head: true }).eq("is_private", false).eq("is_archived", false),
    supabase.from("channel_members").select("channel_id", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("messages").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const members = team.data ?? [];
  const shown = members.slice(0, 3);
  const overflow = members.length - shown.length;
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const onlineNow = members.filter((m) => m.last_seen_at !== null && Date.parse(m.last_seen_at) > cutoff).length;
  const joinable = Math.max(0, (publicChannels.count ?? 0) - (myChannels.count ?? 0));
  const messageCount = readableMessages.count ?? 0;

  return (
    <main className="min-h-dvh bg-bg-col">
      <div className="mx-auto w-full max-w-[540px] px-[24px] pt-[30px] pb-[44px]">
        <div className="flex items-center gap-[9px]">
          <span className="block size-[32px] shrink-0 overflow-hidden rounded-[9px] bg-primary">
            <Image
              src="/commune-logo.png"
              alt=""
              width={32}
              height={32}
              priority
              className="block size-[32px] scale-[1.12] object-cover"
            />
          </span>
          <span className="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">Commune</span>
        </div>

        <h1 className="mt-[28px] text-[25px] leading-[1.2] font-semibold tracking-[-0.03em] text-ink text-pretty">
          Welcome, {firstName}.
        </h1>
        <p className="mt-[9px] text-[14.5px] leading-[1.6] text-fg-600 text-pretty">
          This is how the studio will see you. Google filled in a name and we guessed a handle; change anything.
        </p>
        <p className="mt-[6px] text-[12.5px] leading-[1.55] text-muted-foreground">
          Signed in as {profile.email}.
        </p>

        {members.length > 0 && (
          <div className="mt-[24px] rounded-[12px] border border-border bg-bg-card px-[18px] py-[17px] shadow-xs">
            <div className="flex flex-wrap items-center gap-[14px]">
              {/* The design's stack: 34px rounds overlapped by 9px, each cut out of the card with a 2px ring. */}
              <span className="flex shrink-0" aria-hidden="true">
                {shown.map((m, i) => (
                  <Avatar key={m.id} className={`size-[34px] ring-2 ring-bg-card ${i > 0 ? "-ml-[9px]" : ""}`}>
                    <AvatarImage src={m.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-[12.5px]">
                      {m.display_name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {overflow > 0 && (
                  <span className="-ml-[9px] grid size-[34px] shrink-0 place-items-center rounded-full border border-border bg-bg-chip text-[11.5px] font-semibold tabular-nums text-fg-600 ring-2 ring-bg-card">
                    +{overflow}
                  </span>
                )}
              </span>
              <span className="min-w-[180px] flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">
                  {members.length === 1 ? "1 person already here" : `${members.length} people already here`}
                </span>
                <span className="mt-[2px] block text-[12.5px] leading-[1.5] text-fg-600 text-pretty">
                  {peopleLine(
                    shown.map((m) => m.display_name.split(" ")[0]),
                    overflow,
                  )}
                </span>
              </span>
            </div>

            <span className="my-[15px] block h-px bg-border-subtle" />

            <div className="flex flex-wrap gap-[20px]">
              <span className="min-w-0">
                <span className="block text-[19px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
                  {joinable.toLocaleString("en-US")}
                </span>
                <span className="mt-px block text-[12px] text-fg-600">channels you can join</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[19px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
                  {messageCount.toLocaleString("en-US")}
                </span>
                <span className="mt-px block text-[12px] text-fg-600">messages you can read back</span>
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-[7px] text-[19px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
                  <span className="block size-[8px] rounded-full bg-presence" aria-hidden="true" />
                  {onlineNow.toLocaleString("en-US")}
                </span>
                <span className="mt-px block text-[12px] text-fg-600">online right now</span>
              </span>
            </div>
          </div>
        )}

        <div className="mt-[24px]">
          <ProfileForm profile={profile} mode="welcome" />
        </div>

        {/*
          The design's second action. It is also the only way out: the app shell
          sends anyone without an onboarded_at straight back here, so without it
          the wrong Google account has nowhere to go.
        */}
        <form action={signOut} className="mt-[10px]">
          <Button type="submit" variant="ghost" size="lg" className="rounded-[9px] px-[13px]">
            Not you? Sign out
          </Button>
        </form>

        <p className="mt-[18px] text-[12.5px] leading-[1.55] text-muted-foreground text-pretty">
          Everything in the public channels is readable from your first day — including what was said before you
          arrived.
        </p>
      </div>
    </main>
  );
}

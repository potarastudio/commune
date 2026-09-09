import type { Metadata } from "next";
import { Check, Hash, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/app/(app)/actions";
import { ProfileForm } from "@/components/profile/profile-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { joinChannelAction, setNotificationLevelAction } from "@/lib/actions/channels";
import { saveDndAction } from "@/lib/actions/profile";
import { getChannelsForBrowse } from "@/lib/queries/channel";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome" };

/** Two missed 60s heartbeats (components/presence/presence-provider) still counts as here. */
const ONLINE_WINDOW_MS = 150_000;

/** The studio's working day, used when the account has no quiet hours yet. */
const WORK_START = "09:00";
const WORK_END = "18:00";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const inWords = (n: number) => WORDS[n] ?? n.toLocaleString("en-US");

/** "Hakim, Sari, Raka and nine others." — the design's phrasing, for any team size. */
function peopleLine(names: string[], overflow: number) {
  if (overflow > 0) return `${names.join(", ")} and ${inWords(overflow)} other${overflow === 1 ? "" : "s"}.`;
  if (names.length > 1) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
  return `${names[0]}.`;
}

/**
 * The three steps, in the order the app can actually run them.
 *
 * The design orders them profile → channels → notifications. Ours cannot: the
 * profile save IS the end of onboarding — `saveProfileAction` stamps
 * `onboarded_at` and the form then sends you into the workspace — and the
 * notification step writes `channel_members.notification_level`, which only
 * exists for channels you have already joined. So the two steps that must
 * happen while you are still un-onboarded come first, and the profile is the
 * step that finishes setup. Everything else about the artboards is kept.
 */
const STEPS = ["channels", "notifications", "profile"] as const;
type Step = (typeof STEPS)[number];

const stepSchema = z.enum(STEPS);
const PROGRESS = ["w-[33%]", "w-[67%]", "w-full"];

const NOTIFICATION_LEVELS = ["all", "mentions", "muted"] as const;

// ── Design vocabulary, repeated across the artboards ────────────────────────
const HEADLINE = "mt-[26px] text-[25px] leading-[1.2] font-semibold tracking-[-0.03em] text-ink text-pretty";
const SUBHEAD = "mt-[9px] text-[14.5px] leading-[1.6] text-fg-600 text-pretty";
const ACTIONS = "mt-[22px] flex flex-wrap items-center gap-[10px]";
const CHIP =
  "rounded-[5px] border border-border-strong bg-bg-chip px-[5px] text-[10.5px] font-semibold leading-[16px] text-fg-600";
/** The pickable row: r11, hairline, going to accent-on-accent-surface when checked. */
const PICK_ROW =
  "group flex cursor-pointer items-start gap-[11px] rounded-[11px] border border-border-strong bg-bg-card transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent-surface has-[:disabled]:cursor-default";
const PICK_TITLE = "flex flex-wrap items-center gap-[7px] text-[13.5px] font-semibold text-ink";
const PICK_NOTE =
  "mt-[3px] block text-[12.5px] leading-[1.45] text-fg-600 group-has-[:checked]:text-accent-foreground text-pretty";
const BOX =
  "peer size-[19px] shrink-0 cursor-pointer appearance-none rounded-[6px] border-[1.5px] border-border-input bg-bg-card checked:border-accent-border checked:bg-primary disabled:cursor-default";
const DOT =
  "peer size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-input bg-bg-card checked:border-primary";

/** The 32px r9 logo tile + wordmark, the step counter, and the progress track. */
function Header({ step }: { step?: Step }) {
  const index = step ? STEPS.indexOf(step) + 1 : 0;
  return (
    <>
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
        {index > 0 && (
          <span className="ml-auto text-[12px] font-semibold tabular-nums text-muted-foreground">
            Step {index} of {STEPS.length}
          </span>
        )}
      </div>
      {index > 0 && (
        <span className="mt-[14px] block h-[3px] overflow-hidden rounded-full bg-bg-avatar" aria-hidden="true">
          <span className={`block h-[3px] rounded-full bg-primary ${PROGRESS[index - 1]}`} />
        </span>
      )}
    </>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-[14px] rounded-[10px] border border-danger bg-danger-surface px-[12px] py-[9px] text-[13px] text-danger"
    >
      {message}
    </p>
  );
}

/** The escape hatch: the app shell bounces an un-onboarded account back here. */
function SignOutLine({ email }: { email: string }) {
  return (
    <form action={signOut} className="mt-[18px]">
      <p className="text-[12.5px] leading-[1.55] text-muted-foreground text-pretty">
        Signed in as {email}.{" "}
        <button type="submit" className="link-ink font-medium">
          Not you? Sign out
        </button>
      </p>
    </form>
  );
}

// ── Steps write through the actions the app already ships ───────────────────

/** Step 1 → join every ticked channel, then on to notifications. */
async function joinChannelsAction(formData: FormData) {
  "use server";
  const parsed = z.array(z.string().uuid()).safeParse(formData.getAll("channel").map(String));
  if (!parsed.success) redirect("/welcome?step=channels&e=join");

  const results = await Promise.all(parsed.data.map((channelId) => joinChannelAction({ channelId })));
  if (results.some((r) => !r.ok)) redirect("/welcome?step=channels&e=join");
  redirect("/welcome?step=notifications");
}

/**
 * Step 2 → one notification level across every channel you are in, plus the
 * quiet-hours window. Both go through the same server actions Settings uses.
 */
async function saveNotificationsAction(formData: FormData) {
  "use server";
  const parsed = z
    .object({ level: z.enum(NOTIFICATION_LEVELS), quiet: z.enum(["on"]).optional() })
    .safeParse({ level: formData.get("level"), quiet: formData.get("quiet") ?? undefined });
  if (!parsed.success) redirect("/welcome?step=notifications&e=level");

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const channels = await getJoinedChannels(supabase, profile.id);
  const results = await Promise.all(
    channels
      .filter((c) => c.notification_level !== parsed.data.level)
      .map((c) => setNotificationLevelAction({ channelId: c.id, level: parsed.data.level })),
  );

  const quiet = parsed.data.quiet === "on";
  const dnd = await saveDndAction({
    dnd_start: quiet ? (profile.dnd_start ?? WORK_END) : null,
    dnd_end: quiet ? (profile.dnd_end ?? WORK_START) : null,
  });

  if (results.some((r) => !r.ok) || !dnd.ok) redirect("/welcome?step=notifications&e=level");
  redirect("/welcome?step=profile");
}

/**
 * First run: the setup design's Invited artboard, then the three steps it can
 * genuinely drive — a 540px column on the channel-column ground with the 32px
 * logo, the 25px headline, and the r12 --bg-card panels the artboards draw.
 * The design's fourth screen, the "1 of 3" coach-mark over #general, would
 * live in the app shell rather than here.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; e?: string }>;
}) {
  const { step: rawStep, e } = await searchParams;
  const parsedStep = stepSchema.safeParse(rawStep);
  const step: Step | undefined = parsedStep.success ? parsedStep.data : undefined;

  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/");

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-bg-col">
      <div className="mx-auto w-full max-w-[540px] px-[24px] pt-[30px] pb-[44px]">{children}</div>
    </main>
  );

  // ── Step 1 · Join a few channels ─────────────────────────────────────────
  if (step === "channels") {
    const channels = (await getChannelsForBrowse(supabase, profile.id)).filter((c) => !c.is_archived);
    const joinable = channels.filter((c) => !c.joined);

    return shell(
      <>
        <Header step="channels" />
        <h1 className={HEADLINE}>Join a few channels</h1>
        <p className={SUBHEAD}>
          You&rsquo;re in #general automatically. Tick anything else that looks like your work — you can browse the rest
          once you&rsquo;re in.
        </p>
        {e === "join" && <Alert message="Couldn't join every channel. Try again." />}

        <form action={joinChannelsAction}>
          <div className="mt-[24px] flex flex-col gap-[9px]">
            {channels.map((c) => {
              const locked = c.joined;
              const Icon = c.is_private ? Lock : Hash;
              return (
                <label key={c.id} className={`${PICK_ROW} px-[13px] py-[12px]`}>
                  <span className="relative mt-px grid size-[19px] shrink-0 place-items-center">
                    <input
                      type="checkbox"
                      name="channel"
                      value={c.id}
                      defaultChecked={locked}
                      disabled={locked}
                      className={BOX}
                    />
                    <Check
                      className="pointer-events-none absolute size-[11px] text-white opacity-0 peer-checked:opacity-100"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={PICK_TITLE}>
                      <span className="flex items-center gap-[5px]">
                        <Icon
                          className="size-[12px] text-tertiary group-has-[:checked]:text-accent-foreground"
                          aria-hidden="true"
                        />
                        {c.name}
                      </span>
                      <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">
                        {c.member_count} {c.member_count === 1 ? "member" : "members"}
                      </span>
                      {c.name === "general" ? (
                        <span className={CHIP}>ALWAYS</span>
                      ) : locked ? (
                        <span className={CHIP}>JOINED</span>
                      ) : null}
                    </span>
                    <span className={PICK_NOTE}>
                      {c.description ||
                        c.topic ||
                        (c.is_private ? "Private — only its members can read it." : "No description yet.")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {joinable.length === 0 && (
            <p className="mt-[14px] text-[12.5px] leading-[1.55] text-muted-foreground text-pretty">
              You&rsquo;re already in every channel there is. Start a new one for a project or a client once you&rsquo;re
              inside.
            </p>
          )}

          <div className={ACTIONS}>
            <Button type="submit" size="lg" className="rounded-[9px] px-[16px]">
              {joinable.length === 0 ? "Continue" : "Join and continue"}
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-[9px] px-[13px]">
              <Link href="/welcome">Back</Link>
            </Button>
          </div>
        </form>

        <SignOutLine email={profile.email} />
      </>,
    );
  }

  // ── Step 2 · What should reach you? ──────────────────────────────────────
  if (step === "notifications") {
    const joined = await getJoinedChannels(supabase, profile.id);
    const levels = new Set(joined.map((c) => c.notification_level));
    // An untouched account is uniformly 'all' — the column default, not a
    // choice — so the design's recommended option leads unless the user has
    // already settled every channel on something else.
    const uniform = levels.size === 1 ? [...levels][0] : null;
    const current = uniform && uniform !== "all" ? uniform : "mentions";
    // Quiet hours are stored as the DND window itself, so the design's
    // "quiet outside 09:00 – 18:00" reads back as (dnd_end … dnd_start).
    const quietOn = Boolean(profile.dnd_start && profile.dnd_end);
    const quietUnset = !profile.dnd_start && !profile.dnd_end;
    const workStart = (profile.dnd_end ?? WORK_START).slice(0, 5);
    const workEnd = (profile.dnd_start ?? WORK_END).slice(0, 5);
    const scope = joined.length === 1 ? "the one channel you’re in" : `all ${joined.length} channels you’re in`;

    const options = [
      {
        value: "mentions" as const,
        title: "Mentions and direct messages",
        chip: "RECOMMENDED",
        note: `Notified when someone types @${profile.handle}, or messages you directly.`,
      },
      {
        value: "all" as const,
        title: "All new messages",
        chip: null,
        note: `Every message in ${scope}.`,
      },
      {
        value: "muted" as const,
        title: "Nothing for now",
        chip: null,
        note: "Unread counts still update. Nothing interrupts you.",
      },
    ];

    return shell(
      <>
        <Header step="notifications" />
        <h1 className={HEADLINE}>What should reach you?</h1>
        <p className={SUBHEAD}>
          This sets every channel you&rsquo;re in. You can change all of this later in Settings, channel by channel.
        </p>
        {e === "level" && <Alert message="Couldn't save that. Try again." />}

        <form action={saveNotificationsAction}>
          <div className="mt-[24px] flex flex-col gap-[9px]">
            {options.map((o) => (
              <label key={o.value} className={`${PICK_ROW} px-[14px] py-[13px]`}>
                <span className="relative mt-px grid size-[18px] shrink-0 place-items-center">
                  <input type="radio" name="level" value={o.value} defaultChecked={o.value === current} className={DOT} />
                  <span
                    className="pointer-events-none absolute size-[10px] rounded-full bg-primary opacity-0 peer-checked:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={PICK_TITLE}>
                    {o.title}
                    {o.chip && (
                      <span className="rounded-[5px] border border-accent-surface-border bg-bg-card px-[5px] text-[10.5px] font-semibold leading-[16px] text-accent-foreground">
                        {o.chip}
                      </span>
                    )}
                  </span>
                  <span className={PICK_NOTE}>{o.note}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Quiet hours — the design's toggle row, writing the same dnd_start / dnd_end Settings does. */}
          <label className="mt-[14px] flex cursor-pointer flex-wrap items-center gap-[14px] rounded-[11px] border border-border bg-bg-card px-[15px] py-[14px] shadow-xs">
            <span className="min-w-[180px] flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">
                Quiet outside {workStart} – {workEnd}
              </span>
              <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600 text-pretty">
                Anything sent outside those hours waits for you rather than buzzing. Times are in{" "}
                {profile.timezone.replace(/_/g, " ")}.
              </span>
            </span>
            <span className="relative block h-[22px] w-[38px] shrink-0">
              <input
                type="checkbox"
                name="quiet"
                value="on"
                defaultChecked={quietOn || quietUnset}
                className="peer size-full cursor-pointer appearance-none rounded-full border border-border-input bg-bg-chip transition-colors checked:border-accent-border checked:bg-primary"
              />
              <span
                className="pointer-events-none absolute top-[3px] left-[3px] size-[16px] rounded-full bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.25)] transition-[left] peer-checked:left-[19px]"
                aria-hidden="true"
              />
            </span>
          </label>

          <div className={ACTIONS}>
            <Button type="submit" size="lg" className="rounded-[9px] px-[16px]">
              Continue
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-[9px] px-[13px]">
              <Link href="/welcome?step=channels">Back</Link>
            </Button>
          </div>
        </form>

        <SignOutLine email={profile.email} />
      </>,
    );
  }

  // ── Step 3 · How should the studio see you? ──────────────────────────────
  if (step === "profile") {
    return shell(
      <>
        <Header step="profile" />
        <h1 className={HEADLINE}>How should the studio see you?</h1>
        <p className={SUBHEAD}>
          We pulled this from your Google account. Change anything that isn&rsquo;t right — saving it finishes setup.
        </p>

        <div className="mt-[24px]">
          <ProfileForm profile={profile} mode="welcome" />
        </div>

        {/* The form owns this step's primary ("Start using Commune"), so Back
            sits under it as the row's second action rather than beside it. */}
        <div className="mt-[10px] flex flex-wrap items-center gap-[10px]">
          <Button asChild variant="ghost" size="lg" className="rounded-[9px] px-[13px]">
            <Link href="/welcome?step=notifications">Back</Link>
          </Button>
        </div>

        <SignOutLine email={profile.email} />
      </>,
    );
  }

  // ── Invited ──────────────────────────────────────────────────────────────
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

  return shell(
    <>
      <Header />

      <h1 className="mt-[28px] text-[25px] leading-[1.2] font-semibold tracking-[-0.03em] text-ink text-pretty">
        Welcome to Potara Studio, {firstName}.
      </h1>
      <p className={SUBHEAD}>
        You&rsquo;re signed in as {profile.email}. Three short steps and you&rsquo;re in.
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

      <div className={ACTIONS}>
        <Button asChild size="lg" className="rounded-[9px] px-[16px]">
          <Link href="/welcome?step=channels">Get started</Link>
        </Button>
        {/*
          The design's second action. It is also the only way out: the app shell
          sends anyone without an onboarded_at straight back here, so without it
          the wrong Google account has nowhere to go.
        */}
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="lg" className="rounded-[9px] px-[13px]">
            Not you? Sign out
          </Button>
        </form>
      </div>

      <p className="mt-[18px] text-[12.5px] leading-[1.55] text-muted-foreground text-pretty">
        Everything in the public channels is readable from your first day — including what was said before you arrived.
      </p>
    </>,
  );
}

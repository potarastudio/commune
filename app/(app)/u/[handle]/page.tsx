import type { Metadata } from "next";
import { Hash, Lock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProfileActions } from "@/components/profile/profile-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceLabel } from "@/components/presence/online-dot";
import { getCurrentProfile, getProfileByHandle, getVisibleChannelsFor } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { describeExpiry, isStatusActive, localTimeLabel } from "@/lib/utils/status";

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();
  const person = await getProfileByHandle(supabase, decodeURIComponent(handle));
  return { title: person ? person.display_name : "Profile" };
}

/** 11.5/700 caps overline — the section label used across the redesign. */
const overline = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground";

export default async function ProfilePage({ params }: { params: Params }) {
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();
  const me = await getCurrentProfile(supabase);
  if (!me) redirect("/login");

  const person = await getProfileByHandle(supabase, decodeURIComponent(handle));
  if (!person) notFound();

  const channels = await getVisibleChannelsFor(supabase, person.id, me.id);
  const isMe = person.id === me.id;
  const status = isStatusActive(person) ? person : null;
  const until = status ? describeExpiry(status.status_expires_at, person.timezone) : null;
  const clock = localTimeLabel(person.timezone, me.timezone);
  const joined = new Date(person.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const shared = channels.filter((c) => c.mutual);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Profile</h1>
        <span className="truncate text-[12.5px] text-muted-foreground">@{person.handle}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[620px] px-5 pt-6 pb-16">
          {/* The card echoes the hover card: a chip banner with the avatar hanging into it. */}
          <section className="overflow-hidden rounded-xl border border-border bg-bg-card shadow-xs">
            <div className="h-[72px] border-b border-border-subtle bg-bg-chip" aria-hidden="true" />
            <div className="px-5 pb-5">
              <span className="-mt-[32px] block w-16">
                <Avatar size="3xl" className="ring-4 ring-bg-card">
                  <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{person.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
              </span>

              <h2 className="mt-3 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.025em] text-ink">
                <span className="min-w-0 truncate">{person.display_name}</span>
                {status?.status_emoji && (
                  <span aria-hidden={status.status_text ? "true" : undefined} className="shrink-0 text-[17px] leading-none">
                    {!status.status_text && <span className="sr-only">Status: </span>}
                    {status.status_emoji}
                  </span>
                )}
              </h2>
              <p className="mt-1 truncate text-[13px] text-fg-600">
                @{person.handle}
                {person.title ? ` · ${person.title}` : ""}
                {person.role === "admin" ? " · Admin" : ""}
              </p>

              {status?.status_text && (
                <p className="mt-3 inline-flex max-w-full items-start gap-2 rounded-md border border-border-subtle bg-bg-chip px-[9px] py-[7px] text-[12.5px] text-fg-400">
                  {status.status_emoji && (
                    <span aria-hidden="true" className="shrink-0 text-[13px] leading-[1.4]">
                      {status.status_emoji}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="sr-only">Status: </span>
                    <span className="block leading-[1.4]">{status.status_text}</span>
                    {until && <span className="block text-[12px] leading-[1.4] text-tertiary">{until}</span>}
                  </span>
                </p>
              )}

              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                <PresenceLabel userId={person.id} />
                <span aria-hidden="true">·</span>
                {clock && <span>{clock} local time</span>}
                {clock && <span aria-hidden="true">·</span>}
                <span>Joined {joined}</span>
                {isMe && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{person.email}</span>
                  </>
                )}
              </p>

              <div className="mt-4">
                <ProfileActions userId={person.id} handle={person.handle} isMe={isMe} />
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h3 className={overline}>{isMe ? "Your channels" : "Channels you share"}</h3>
            {shared.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-border px-4 py-5 text-center text-[13px] text-fg-600">
                {isMe
                  ? "You are not in any channels yet."
                  : `You and ${person.display_name.split(" ")[0]} are not in any of the same channels yet.`}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border-subtle rounded-lg border border-border">
                {shared.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/channel/${c.id}`}
                      className="flex h-9 items-center gap-2.5 px-3 text-[13.5px] text-body hover:bg-bg-hover"
                    >
                      {c.is_private ? (
                        <Lock className="size-[13px] shrink-0 text-tertiary" aria-hidden="true" />
                      ) : (
                        <Hash className="size-[13px] shrink-0 text-tertiary" aria-hidden="true" />
                      )}
                      <span className="min-w-0 truncate">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

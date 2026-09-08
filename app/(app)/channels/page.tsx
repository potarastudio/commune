import type { Metadata } from "next";
import { Hash, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateChannelPopover } from "@/components/channel/create-channel-popover";
import { JoinLeaveButton } from "@/components/channel/join-leave-button";
import { getChannelsForBrowse } from "@/lib/queries/channel";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Browse channels" };

/** Every channel you can see: public ones to join, private ones you belong to (§5). */
export default async function BrowseChannelsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const channels = await getChannelsForBrowse(supabase, profile.id);
  const joined = channels.filter((c) => c.joined);
  const others = channels.filter((c) => !c.joined);

  const Row = ({ c }: { c: (typeof channels)[number] }) => {
    const Icon = c.is_private ? Lock : Hash;
    return (
      <li className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-message-hover">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/channel/${c.id}`} className="text-[14px] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {c.name}
          </Link>
          <p className="truncate text-[12px] text-muted-foreground">
            {c.member_count} {c.member_count === 1 ? "member" : "members"}
            {c.description ? ` · ${c.description}` : c.topic ? ` · ${c.topic}` : ""}
          </p>
        </div>
        <JoinLeaveButton channelId={c.id} channelName={c.name} joined={c.joined} />
      </li>
    );
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Channels</h1>
        <span className="text-[13px] text-muted-foreground">
          {channels.length} you can see
        </span>
        <div className="ml-auto">
          <CreateChannelPopover />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-3 py-6">
          {others.length > 0 && (
            <section>
              <h2 className="px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">You can join</h2>
              <ul className="mt-2 space-y-0.5">
                {others.map((c) => (
                  <Row key={c.id} c={c} />
                ))}
              </ul>
            </section>
          )}
          <section className={others.length > 0 ? "mt-8" : ""}>
            <h2 className="px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Your channels</h2>
            <ul className="mt-2 space-y-0.5">
              {joined.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          </section>
          {others.length === 0 && (
            <p className="mt-8 px-3 text-center text-[13px] text-muted-foreground">
              You&apos;re in every channel there is. Start a new one for a project or a client.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

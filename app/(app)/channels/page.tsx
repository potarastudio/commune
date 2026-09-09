import type { Metadata } from "next";
import { Archive, Check, Hash, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateChannelPopover } from "@/components/channel/create-channel-popover";
import { JoinLeaveButton } from "@/components/channel/join-leave-button";
import { Button } from "@/components/ui/button";
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
  const live = channels.filter((c) => !c.is_archived);
  const joined = live.filter((c) => c.joined);
  const others = live.filter((c) => !c.joined);
  const archived = channels.filter((c) => c.is_archived);

  const Row = ({ c }: { c: (typeof channels)[number] }) => {
    const Icon = c.is_archived ? Archive : c.is_private ? Lock : Hash;
    return (
      <li className="flex items-center gap-[13px] border-b border-border-subtle px-5 py-[13px] transition-colors hover:bg-bg-hover">
        <span
          className={`grid size-[38px] shrink-0 place-items-center rounded-[10px] border border-border-subtle ${
            c.is_archived ? "bg-bg-subtle text-tertiary" : "bg-bg-chip text-fg-600"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-2 text-[14px] font-semibold text-ink">
            <Link href={`/channel/${c.id}`} className="hover:underline">
              {c.name}
            </Link>
            <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
              {c.member_count} {c.member_count === 1 ? "member" : "members"}
              {c.is_private ? " · private" : ""}
              {c.is_archived ? " · archived" : ""}
            </span>
          </p>
          {(c.description || c.topic) && (
            <p className="mt-[3px] truncate text-[13px] text-fg-600">{c.description || c.topic}</p>
          )}
        </div>
        {c.is_archived ? (
          <span className="flex h-8 shrink-0 items-center rounded-md border border-border bg-bg-chip px-[11px] text-[12.5px] font-semibold text-fg-600">
            Read only
          </span>
        ) : c.joined ? (
          <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg-chip px-[11px] text-[12.5px] font-semibold text-fg-600">
            <Check className="size-[13px]" aria-hidden="true" />
            Joined
          </span>
        ) : (
          <JoinLeaveButton channelId={c.id} channelName={c.name} joined={false} />
        )}
      </li>
    );
  };

  const Overline = ({ children }: { children: React.ReactNode }) => (
    <h2 className="sticky top-0 z-[2] border-b border-border-subtle bg-bg-main px-5 py-[9px] text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
      {children}
    </h2>
  );

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Browse channels</h1>
        <span className="text-[12.5px] text-muted-foreground">
          {live.length} {live.length === 1 ? "channel" : "channels"}
        </span>
        <div className="ml-auto">
          <CreateChannelPopover>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-[7px] px-[11px] has-[>svg]:px-[11px]">
              <Plus className="size-[14px] text-fg-600" aria-hidden="true" />
              Create
            </Button>
          </CreateChannelPopover>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
            <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
              <Hash className="size-[17px]" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No channels yet</h2>
            <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
              Channels are where the studio talks about a topic, project or client. Start the first one.
            </p>
          </div>
        ) : (
          <>
            {others.length > 0 && (
              <section>
                <Overline>You can join</Overline>
                <ul>
                  {others.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </ul>
              </section>
            )}

            <section>
              <Overline>Your channels</Overline>
              <ul>
                {joined.map((c) => (
                  <Row key={c.id} c={c} />
                ))}
              </ul>
              {others.length === 0 && (
                <p className="border-b border-border-subtle px-5 py-[13px] text-[13px] leading-[1.55] text-fg-600">
                  You&rsquo;re in every channel there is. Start a new one for a project or a client.
                </p>
              )}
            </section>

            {archived.length > 0 && (
              <section>
                <Overline>Archived</Overline>
                <p className="border-b border-border-subtle px-5 py-[11px] text-[13px] leading-[1.55] text-fg-600">
                  Still readable and searchable. Admins can bring one back from inside the channel.
                </p>
                <ul>
                  {archived.map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

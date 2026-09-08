import type { Metadata } from "next";
import { AtSign, SmilePlus } from "lucide-react";
import { redirect } from "next/navigation";
import { ActivityItem } from "@/components/activity/activity-item";
import { getMentionsOfMe, getReactionsOnMyMessages, messageHref } from "@/lib/queries/activity";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderContent } from "@/lib/utils/render";

export const metadata: Metadata = { title: "Activity" };

/** "Mentions & reactions" (§5): what other people did that involves you. */
export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const [mentions, reactions] = await Promise.all([getMentionsOfMe(supabase, profile.id), getReactionsOnMyMessages(supabase, profile.id)]);

  const where = (m: { channel: { name: string } | null; conversation: unknown }) =>
    m.channel ? `#${m.channel.name}` : m.conversation ? "a direct message" : "";

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Activity</h1>
        <span className="ml-2 text-[13px] text-muted-foreground">Mentions &amp; reactions</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-3 py-6">
          <section>
            <h2 className="flex items-center gap-2 px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <AtSign className="size-3.5" aria-hidden="true" /> Mentions
            </h2>
            {mentions.length === 0 ? (
              <p className="px-3 py-6 text-[13px] text-muted-foreground">
                Nobody has mentioned you yet. When someone writes @{profile.handle}, @channel or @here, it shows up here.
              </p>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {mentions.map((m) => (
                  <ActivityItem
                    key={m.id}
                    href={messageHref(m.message)}
                    person={m.message.author}
                    createdAt={m.message.created_at}
                    eyebrow={
                      <>
                        <span className="font-medium text-foreground">{m.message.author?.display_name ?? "Someone"}</span>{" "}
                        {m.kind === "user" ? "mentioned you" : `used @${m.kind}`} in {where(m.message)}
                        {m.message.parent_id ? " · in a thread" : ""}
                      </>
                    }
                  >
                    {renderContent(m.message.content as Parameters<typeof renderContent>[0])}
                  </ActivityItem>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="flex items-center gap-2 px-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <SmilePlus className="size-3.5" aria-hidden="true" /> Reactions to your messages
            </h2>
            {reactions.length === 0 ? (
              <p className="px-3 py-6 text-[13px] text-muted-foreground">No reactions yet. Say something worth a 🔥.</p>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {reactions.map((r) => (
                  <ActivityItem
                    key={`${r.message.id}-${r.reactor?.id}-${r.emoji}`}
                    href={messageHref(r.message)}
                    person={r.reactor}
                    createdAt={r.created_at}
                    eyebrow={
                      <>
                        <span className="font-medium text-foreground">{r.reactor?.display_name ?? "Someone"}</span> reacted{" "}
                        <span className="text-[14px]">{r.emoji}</span> in {where(r.message)}
                      </>
                    }
                  >
                    <span className="text-muted-foreground">{r.message.content_text}</span>
                  </ActivityItem>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

import { Hash } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getGeneralChannelId } from "@/lib/queries/channel";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Home is #general, like a workspace's landing channel. With no #general and no
 * channels joined, the first run gets the design's empty treatment rather than a
 * dead end.
 */
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const general = await getGeneralChannelId(supabase);
  if (general) redirect(`/channel/${general}`);

  const joined = await getJoinedChannels(supabase, profile.id);
  if (joined.length > 0) redirect(`/channel/${joined[0].id}`);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Commune</h1>
        <span className="text-[12.5px] text-muted-foreground">Potara Studio</span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
          <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
            <Hash className="size-[17px]" aria-hidden="true" />
          </span>
          <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">
            Welcome, {profile.display_name.split(" ")[0]}
          </h2>
          <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
            You&rsquo;re not in a channel yet. Browse what the studio has, or start one for a project or a client.
          </p>
          <Button asChild className="mt-3 h-8">
            <Link href="/channels">Browse channels</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

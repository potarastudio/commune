import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { getJoinedChannels } from "@/lib/queries/channels";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (!profile.onboarded_at) redirect("/welcome");

  const channels = await getJoinedChannels(supabase, profile.id);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar profile={profile} channels={channels} />
      <main className="flex min-w-0 flex-1 flex-col bg-background">{children}</main>
    </div>
  );
}

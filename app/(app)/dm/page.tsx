import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesScreen } from "@/components/mobile/messages-screen";
import { getMyConversations } from "@/lib/queries/conversations";
import { getCurrentProfile } from "@/lib/queries/profile";
import { isMobileRequest } from "@/lib/mobile-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toUnreadMap } from "@/lib/utils/unreads";

export const metadata: Metadata = { title: "Messages" };

/**
 * The DMs tab's root on a phone (design: Mobile Navigation, "/dm new"). The
 * desktop keeps its conversations in the sidebar, so there /dm goes straight
 * to the latest one, or to starting one.
 */
export default async function DirectMessagesPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const conversations = await getMyConversations(supabase);
  if (!(await isMobileRequest())) redirect(conversations[0] ? `/dm/${conversations[0].id}` : "/dm/new");

  const { data: unreadRows, error } = await supabase.rpc("get_unread_counts");
  if (error) throw new Error(error.message);
  return <MessagesScreen meId={profile.id} conversations={conversations} initialUnreads={toUnreadMap(unreadRows)} />;
}

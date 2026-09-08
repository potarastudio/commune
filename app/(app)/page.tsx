import { redirect } from "next/navigation";
import { getGeneralChannelId } from "@/lib/queries/channel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Home is #general, like a workspace's landing channel. */
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const general = await getGeneralChannelId(supabase);
  redirect(general ? `/channel/${general}` : "/login");
}

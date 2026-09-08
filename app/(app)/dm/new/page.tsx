import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewMessagePicker } from "@/components/dm/new-message-picker";
import { getCurrentProfile, type Profile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New message" };

export default async function NewMessagePage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const { data, error } = await supabase.from("profiles").select("*").order("display_name");
  if (error) throw new Error(error.message);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">New message</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <NewMessagePicker people={data as Profile[]} meId={profile.id} />
      </div>
    </>
  );
}

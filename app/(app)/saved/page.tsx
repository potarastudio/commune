import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SavedList } from "@/components/saved/saved-list";
import { fetchSaved } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  const saved = await fetchSaved(supabase, profile.id);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Saved</h1>
        <span className="ml-2 text-[13px] text-muted-foreground">
          {saved.length === 0 ? "For later" : `${saved.length} ${saved.length === 1 ? "message" : "messages"} for later`}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-3 py-6">
          <SavedList meId={profile.id} initialSaved={saved} />
        </div>
      </div>
    </>
  );
}

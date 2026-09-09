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
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Saved</h1>
        <span className="text-[12.5px] text-muted-foreground">
          {saved.length === 0 ? "For later" : `${saved.length} ${saved.length === 1 ? "item" : "items"}`}
        </span>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <SavedList meId={profile.id} initialSaved={saved} />
      </div>
    </>
  );
}

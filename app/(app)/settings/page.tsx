import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <section className="mx-auto w-full max-w-lg px-6 py-8">
          <h2 className="text-[16px] font-semibold tracking-tight">Profile</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Your name, handle and photo across Commune.</p>
          <div className="mt-6">
            <ProfileForm profile={profile} mode="settings" />
          </div>
        </section>
      </div>
    </>
  );
}

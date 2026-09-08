import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentProfile } from "@/lib/queries/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your profile" };

/** First run: confirm name, handle and photo before entering the workspace. */
export default async function WelcomePage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/");

  const firstName = profile.display_name.split(" ")[0];

  return (
    <main className="grid min-h-dvh place-items-center bg-sidebar px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
            C
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Commune</span>
        </div>
        <h1 className="mt-6 text-[24px] font-semibold leading-tight tracking-tight">Welcome, {firstName}.</h1>
        <p className="mt-1.5 text-muted-foreground">
          This is how the studio will see you. Google filled in a name and we guessed a handle; change anything.
        </p>
        <div className="mt-8">
          <ProfileForm profile={profile} mode="welcome" />
        </div>
      </div>
    </main>
  );
}

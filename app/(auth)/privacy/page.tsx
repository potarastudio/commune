import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

/** Public privacy notice for Commune, an internal tool for Potara Studio's team. Needed for Google's app verification too. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <Link href="/login" className="flex w-fit items-center gap-2.5 text-[15px] font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">C</span>
        Commune
      </Link>
      <h1 className="mt-10 text-[28px] font-semibold leading-tight tracking-tight">Privacy notice</h1>
      <p className="mt-2 text-muted-foreground">Last updated 9 September 2026</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        <section>
          <h2>What Commune is</h2>
          <p>
            Commune is the private team chat used by Potara Studio, a design agency in Jakarta. It is only for the studio&apos;s own people. You can
            sign in only if a Potara admin has added your email address to the invite list.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Your account.</strong> When you sign in with Google we receive your email address, your name and your profile photo. When you
              sign in with an email link we receive only your email address. We use these to create your profile and to know who is who.
            </li>
            <li>
              <strong>What you write and share.</strong> Messages, threads, reactions, files, bookmarks, reminders and your status are stored so the
              team can read them. Messages you delete are hidden for everyone; edits keep their history.
            </li>
            <li>
              <strong>Presence and notifications.</strong> Whether you are online, when you last had Commune open, and, if you turn them on, a
              browser push subscription so we can notify you about mentions and direct messages.
            </li>
            <li>
              <strong>Huddles.</strong> Audio and video in huddles stream through LiveKit and are not recorded.
            </li>
          </ul>
        </section>

        <section>
          <h2>How it is used</h2>
          <p>
            Only to run Commune for the studio: showing messages to the people allowed to see them, sending notifications you asked for, and
            emailing you sign-in links, invitations and digests of mentions you missed. There is no advertising, no analytics profiling and no
            sale of data.
          </p>
        </section>

        <section>
          <h2>Who can see it</h2>
          <p>
            Other members of Potara Studio, according to the channel or conversation a message is in. Private channels and direct messages are
            visible only to their members. Studio admins can remove messages and manage members.
          </p>
        </section>

        <section>
          <h2>Where it is stored</h2>
          <p>
            Data is stored with Supabase (Singapore region) and the app runs on Vercel. Emails are sent through Resend. Huddle media is handled by
            LiveKit. These providers process data on Potara Studio&apos;s behalf.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <ul>
            <li>Edit your name, handle, photo, status and notification settings any time in Settings.</li>
            <li>Turn browser notifications and email digests off in Settings.</li>
            <li>Ask a studio admin to remove your account. Your messages stay in the channels they were posted in, attributed to you.</li>
          </ul>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about this notice go to Potara Studio at <a href="mailto:hi@potarastudio.com" className="text-link underline-offset-2 hover:underline">hi@potarastudio.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

/** Public privacy notice for Commune, an internal tool for Potara Studio's team. Needed for Google's app verification too. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[680px] px-[24px] pt-[30px] pb-[64px]">
      <Link
        href="/login"
        className="flex w-fit items-center gap-[9px] rounded-[8px] text-[14.5px] font-semibold tracking-[-0.015em] text-ink"
      >
        <span className="block size-[32px] shrink-0 overflow-hidden rounded-[9px] bg-primary">
          <Image
            src="/commune-logo.png"
            alt=""
            width={32}
            height={32}
            className="block size-[32px] scale-[1.12] object-cover"
          />
        </span>
        Commune
      </Link>

      <h1 className="mt-[28px] text-[30px] leading-[1.15] font-semibold tracking-[-0.032em] text-ink text-pretty">
        Privacy notice
      </h1>
      <p className="mt-[9px] text-[13px] text-muted-foreground">Last updated 9 September 2026</p>

      <div className="mt-[28px] flex flex-col gap-[28px] text-[14px] leading-[1.6] text-body [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-ink [&_p]:mt-[7px] [&_p]:text-pretty [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-[7px] [&_ul]:list-disc [&_ul]:space-y-[6px] [&_ul]:pl-[22px] [&_ul]:marker:text-tertiary">
        <section>
          <h2>What Commune is</h2>
          <p>
            Commune is the private team chat used by Potara Studio, a design agency in Purwokerto. It is only for the studio&apos;s own people. You can
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
            Questions about this notice go to Potara Studio at <a href="mailto:hi@potarastudio.com" className="link-ink">hi@potarastudio.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}

import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { HashError } from "@/components/auth/hash-error";
import { LoginPreview } from "@/components/auth/login-preview";
import { SignInForm } from "@/components/auth/magic-link-form";

export const metadata: Metadata = { title: "Sign in" };

const errorCopy: Record<string, { title: string; body: string }> = {
  allowlist: {
    title: "This Google account isn't on the Potara list yet.",
    body: "Ask Hakim to add your email, then try again with the same account.",
  },
  oauth: {
    title: "Google sign-in didn't complete.",
    body: "Nothing was changed. Try again, and if it keeps happening tell Hakim which account you used.",
  },
  link: {
    title: "That sign-in link didn't work.",
    body: "Links work once and expire after an hour. Request a new one below and open it on this device.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const err = error ? errorCopy[error] : undefined;

  return (
    /*
      The design's two panes are `min-width:300px; flex:5` and
      `min-width:320px; flex:6`, wrapping when they no longer fit. The grid
      reproduces both: the 5:6 ratio and the per-pane floors, so the rail is
      never squeezed below 300px — it stacks instead, preview and all.
    */
    <main className="grid min-h-dvh grid-rows-[auto_1fr] min-[660px]:grid-cols-[minmax(300px,5fr)_minmax(320px,6fr)] min-[660px]:grid-rows-1">
      <HashError />

      {/* The rail: near-black in both themes, so its palette is fixed white. */}
      <section className="flex flex-col justify-between gap-[36px] bg-rail px-[28px] pt-[26px] pb-[24px]">
        <div className="flex items-center gap-[9px]">
          <span className="block size-[32px] shrink-0 overflow-hidden rounded-[9px] bg-primary">
            <Image
              src="/commune-logo.png"
              alt=""
              width={32}
              height={32}
              priority
              className="block size-[32px] scale-[1.12] object-cover"
            />
          </span>
          <span className="text-[14.5px] font-semibold tracking-[-0.015em] text-white">Commune</span>
        </div>
        <LoginPreview />
        <p className="text-[12px] text-white/40">Potara Studio · Jakarta</p>
      </section>

      <section className="flex items-center justify-center bg-bg-main px-[28px] py-[40px]">
        <div className="w-full max-w-[400px]">
          <p className="text-[11.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground">Potara Studio</p>
          <h1 className="mt-[9px] text-[28px] leading-[1.18] font-semibold tracking-[-0.03em] text-ink text-pretty">
            Sign in to Commune
          </h1>
          <p className="mt-[9px] text-[14px] leading-[1.6] text-fg-600 text-pretty">
            Channels, threads and huddles for the studio. Use the Google account you were invited with, or get a
            one-time link by email.
          </p>

          {err && (
            <div
              role="alert"
              className="mt-[22px] flex gap-[11px] rounded-[11px] border border-danger bg-danger-surface px-[13px] py-[12px]"
            >
              <span className="mt-px grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-danger text-white">
                <CircleAlert className="size-[13px]" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">{err.title}</span>
                <span className="mt-[3px] block text-[12.5px] leading-[1.55] text-fg-600 text-pretty">{err.body}</span>
              </span>
            </div>
          )}

          <SignInForm next={next ?? "/"} expired={error === "link"} />

          <p className="mt-[24px] text-[12px] leading-[1.6] text-muted-foreground text-pretty">
            Only invited addresses can sign in, whichever way you choose. Not invited yet? Ask Hakim to add your email.
          </p>
        </div>
      </section>
    </main>
  );
}

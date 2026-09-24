"use client";

import { CircleAlert, Mail } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMagicLink, signInWithGoogle, type MagicLinkState } from "@/app/(auth)/login/actions";
import { isNativeApp, native, nativePlatform } from "@/lib/native";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { GoogleIcon } from "./google-icon";

/** Where the app's sign-in ends: the handoff mints a one-time token and opens commune:// (app/desktop/handoff). */
const HANDOFF = "/desktop/handoff";
const LAST_EMAIL_KEY = "commune-last-email";

const BIG = "flex h-[52px] w-full shrink-0 items-center justify-center rounded-[14px] text-[16px] font-semibold";

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "commune-spin block size-[15px] shrink-0 rounded-full border-[1.5px]",
        light ? "border-white/40 border-t-white" : "border-border-hover border-t-primary",
      )}
    />
  );
}

function GoogleButton({ onApp }: { onApp?: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={
        onApp
          ? (e) => {
              e.preventDefault();
              onApp();
            }
          : undefined
      }
      className={cn(BIG, "gap-[11px] border border-ink bg-ink text-bg-main shadow-[0_1px_2px_0_var(--shadow-tint-md)] active:opacity-[0.88] disabled:opacity-70")}
    >
      {pending ? <Spinner light /> : <GoogleIcon className="size-[19px]" />}
      Continue with Google
    </button>
  );
}

/** The inbox, where the phone has a way to open it; a mailto: would only start a new email. */
function inboxUrl(): string | null {
  const platform = nativePlatform();
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (platform === "ios" || /iPhone|iPod/.test(ua)) return "message://";
  if (platform === "android" || /Android/.test(ua)) return "intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end";
  return null;
}

/**
 * Sign in on a phone (design: Mobile Onboarding → Sign in, Link sent, Not
 * invited). One column, Google first because that is how people were
 * invited, the email link as a labelled alternative. Inside the app both ways
 * finish in the system browser and come back through commune://, since Google
 * refuses to sign in inside an app's web view and a link opens wherever mail
 * opens links.
 */
export function MobileSignIn({
  next,
  error,
  expired = false,
}: {
  next: string;
  error?: { title: string; body: string };
  expired?: boolean;
}) {
  const hydrated = useHydrated();
  const inApp = hydrated && isNativeApp();
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status !== "sent") return;
    setEditing(false);
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, state.email);
    } catch {
      // A convenience only.
    }
  }, [state]);

  useEffect(() => {
    if (!expired) return;
    try {
      setEmail(window.localStorage.getItem(LAST_EMAIL_KEY) ?? "");
    } catch {
      // A convenience only.
    }
    input.current?.focus();
  }, [expired]);

  const linkNext = inApp ? HANDOFF : next;
  const openGoogleInBrowser = inApp ? () => native.openBrowser(`${window.location.origin}/auth/google?next=${encodeURIComponent(HANDOFF)}`) : undefined;
  const invalid = state.status === "error";
  const sentTo = state.status === "sent" && !editing ? state.email : null;

  if (sentTo) {
    const inbox = hydrated ? inboxUrl() : null;
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-[24px] pt-[34px] pb-[30px]">
        <span className="grid size-[56px] shrink-0 place-items-center rounded-[16px] border border-accent-surface-border bg-accent-surface text-accent-foreground">
          <Mail className="size-[25px]" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="mt-[20px] text-[25px] leading-[1.2] font-semibold tracking-[-0.03em] text-ink [text-wrap:pretty]">Check your inbox</h1>
        <p role="status" className="mt-[10px] text-[15px] leading-[1.6] text-fg-600 [text-wrap:pretty]">
          We sent a sign-in link to <span className="font-semibold text-ink">{sentTo}</span>. Open it on this phone — it works once and expires
          in an hour.{inApp ? " It brings you straight back to the app." : ""}
        </p>
        <div className="mt-[24px] flex flex-col gap-[10px]">
          {inbox && (
            <a
              href={inbox}
              className={cn(
                BIG,
                "gap-[9px] border border-accent-border bg-primary text-white shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.2)]",
              )}
            >
              <Mail className="size-[19px]" strokeWidth={1.75} aria-hidden="true" />
              Open mail app
            </a>
          )}
          <form action={action}>
            <input type="hidden" name="email" value={sentTo} />
            <input type="hidden" name="next" value={linkNext} />
            <button type="submit" disabled={pending} className={cn(BIG, "gap-[9px] border border-border-strong bg-bg-card text-ink active:bg-bg-subtle")}>
              {pending ? (
                <>
                  <Spinner />
                  Sending…
                </>
              ) : (
                "Send it again"
              )}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              requestAnimationFrame(() => input.current?.focus());
            }}
            className={cn(BIG, "text-fg-600")}
          >
            Use a different address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-[24px] pt-[34px] pb-[30px]">
      <span className="block size-[44px] shrink-0 overflow-hidden rounded-[12px] bg-primary">
        <Image src="/commune-logo.png" alt="Commune" width={44} height={44} priority className="block size-[44px] scale-[1.1] object-cover" />
      </span>
      <h1 className="mt-[22px] text-[27px] leading-[1.18] font-semibold tracking-[-0.03em] text-ink [text-wrap:pretty]">Sign in to Commune</h1>
      {error ? (
        <div role="alert" className="mt-[18px] flex gap-[11px] rounded-[13px] border border-danger bg-danger-surface px-[14px] py-[13px]">
          <span className="mt-px grid size-[24px] shrink-0 place-items-center rounded-[8px] bg-danger text-white">
            <CircleAlert className="size-[14px]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-ink">{error.title}</span>
            <span className="mt-[4px] block text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">{error.body}</span>
          </span>
        </div>
      ) : (
        <p className="mt-[9px] text-[15px] leading-[1.55] text-fg-600 [text-wrap:pretty]">Channels, threads and huddles for Potara Studio.</p>
      )}

      <form action={signInWithGoogle} className="mt-[22px]">
        <input type="hidden" name="next" value={next} />
        <GoogleButton onApp={openGoogleInBrowser} />
      </form>
      {inApp && <p className="mt-[10px] text-[12.5px] leading-[1.5] text-muted-foreground">Google opens in a browser sheet and brings you straight back.</p>}

      <div aria-hidden="true" className="my-[20px] flex items-center gap-[12px]">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action}>
        <input type="hidden" name="next" value={linkNext} />
        <label htmlFor="mobile-email" className="mb-[7px] block text-[13px] font-semibold text-fg-400">
          Email address
        </label>
        <span
          data-invalid={invalid ? "true" : undefined}
          className={cn(
            "flex h-[52px] w-full items-center gap-[9px] rounded-[13px] border bg-bg-card px-[14px] shadow-[0_1px_2px_0_var(--shadow-tint-sm)] transition-[border-color,box-shadow]",
            invalid
              ? "border-danger shadow-[0_0_0_3px_var(--danger-surface)]"
              : "border-border-input focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--accent-surface)]",
          )}
        >
          <Mail className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={input}
            id="mobile-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            enterKeyHint="send"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@potarastudio.com"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "mobile-email-error" : undefined}
            className="h-full min-w-0 flex-1 bg-transparent text-[15.5px] text-body outline-none placeholder:text-muted-foreground"
          />
        </span>
        {invalid && (
          <p id="mobile-email-error" role="alert" className="mt-[9px] flex gap-[7px] text-[13px] leading-[1.55] text-danger [text-wrap:pretty]">
            <CircleAlert className="mt-[2px] size-[14px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {state.message}
          </p>
        )}
        <button type="submit" disabled={pending} className={cn(BIG, "mt-[10px] gap-[9px] border border-border-strong bg-bg-card text-ink shadow-[0_1px_2px_0_var(--shadow-tint-sm)] active:bg-bg-subtle")}>
          {pending ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : (
            "Email me a link"
          )}
        </button>
      </form>

      <p className="mt-[20px] text-[12.5px] leading-[1.55] text-muted-foreground [text-wrap:pretty]">
        Only invited addresses can sign in. Not invited yet? Ask Hakim to add your email.
      </p>
    </div>
  );
}

"use client";

import { CircleAlert, Mail } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMagicLink, signInWithGoogle, type MagicLinkState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { desktopBridge } from "@/lib/desktop";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { GoogleIcon } from "./google-icon";

/**
 * The address the last link was sent to, remembered on this device only so the
 * expired-link retry does not ask for it again — the design draws that field
 * pre-filled and focused. Never leaves the browser.
 */
const LAST_EMAIL_KEY = "commune-last-email";

function rememberEmail(email: string) {
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    // Private mode or a blocked store: the prefill is a convenience, not a feature.
  }
}

function recallEmail(): string {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The design's 13px spinner: a hairline ring with an accent cap. */
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="commune-spin block size-[13px] shrink-0 rounded-full border-[1.5px] border-border-hover border-t-primary"
    />
  );
}

/**
 * Google is the primary path, so it is the ink button. It goes disabled while a
 * magic link is being sent — two sign-ins at once is never what you meant —
 * which is why it lives in this client component rather than in the page.
 */
function GoogleButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="xl"
      disabled={blocked || pending}
      // px16 per the design; the xl size drops to 14 when a button holds an svg.
      className="w-full border-ink bg-ink text-bg-main shadow-sm has-[>svg]:px-[16px] hover:border-ink hover:bg-ink hover:opacity-[0.88]"
    >
      <GoogleIcon className="size-[17px]" />
      Continue with Google
    </Button>
  );
}

/**
 * Both ways in: Google OAuth and the one-time email link (§5). The allowlist is
 * checked before the link is sent, so a rejected address fails on the field
 * instead of in silence.
 *
 * `expired` marks the return trip from a dead link (?error=link): the design's
 * linkExpired artboard has the field pre-filled and focused, ready for Enter.
 */
export function SignInForm({ next, expired = false }: { next: string; expired?: boolean }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });
  // Google sign-in is PKCE: the client that starts it holds a one-time secret
  // the callback needs. The desktop window cannot finish in the browser it
  // opens, so inside the app every sign-in hands the whole page to the
  // browser, where the flow starts and ends in one place and the handoff
  // route brings the session back. Decided after hydration so the server and
  // client render the same form.
  const desktop = useHydrated() ? desktopBridge() : null;
  const toBrowser = desktop
    ? (e: React.FormEvent) => {
        e.preventDefault();
        void desktop.signIn();
      }
    : undefined;
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A fresh send always returns to the status card, even after "use a different address".
  useEffect(() => {
    if (state.status === "sent") {
      setEditing(false);
      rememberEmail(state.email);
    }
  }, [state]);

  // The link the user just followed is dead: hand the field back with the
  // address already in it, cursor waiting, so retrying is one keystroke.
  useEffect(() => {
    if (!expired) return;
    const remembered = recallEmail();
    if (remembered) setEmail(remembered);
    inputRef.current?.focus();
  }, [expired]);

  const sentTo = state.status === "sent" && !editing ? state.email : null;
  const invalid = state.status === "error";

  const useDifferentAddress = () => {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      <form action={signInWithGoogle} onSubmit={toBrowser} className="mt-[26px]">
        <input type="hidden" name="next" value={next} />
        <GoogleButton blocked={pending} />
      </form>
      {desktop && (
        <p className="mt-[10px] text-[12px] leading-[1.5] text-muted-foreground">
          Sign-in opens in your browser and brings you straight back here.
        </p>
      )}

      <div aria-hidden="true" className="my-[22px] flex items-center gap-[12px]">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {sentTo !== null ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[11px] border border-accent-surface-border bg-accent-surface px-[15px] py-[14px]"
        >
          <p className="flex items-center gap-[8px] text-[13.5px] font-semibold text-accent-foreground">
            <Mail className="size-[15px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Check your inbox
          </p>
          <p className="mt-[6px] text-[12.5px] leading-[1.6] text-accent-foreground text-pretty">
            We sent a sign-in link to <span className="font-semibold">{sentTo}</span>. Open it on this device — it works
            once and expires in an hour.
          </p>
          <div className="mt-[11px] flex flex-wrap items-center gap-[8px]">
            <form action={action} onSubmit={toBrowser}>
              <input type="hidden" name="email" value={sentTo} />
              <input type="hidden" name="next" value={next} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={pending}
                // No shadow here, and hover keeps the accent-tinted border.
                className="h-[32px] gap-[7px] rounded-[8px] border-accent-surface-border px-[11px] text-[12.5px] shadow-none hover:border-accent-surface-border disabled:opacity-100 disabled:text-muted-foreground"
              >
                {pending ? (
                  <>
                    <Spinner />
                    Sending…
                  </>
                ) : (
                  "Send it again"
                )}
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={useDifferentAddress}
              className="h-[32px] rounded-[8px] px-[9px] text-[12.5px] text-accent-foreground hover:bg-bg-card hover:text-accent-foreground"
            >
              Use a different address
            </Button>
          </div>
        </div>
      ) : (
        <form action={action} onSubmit={toBrowser}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="magic-email" className="mb-[7px] block text-[12.5px] font-semibold text-fg-400">
            Email address
          </label>
          <div className="flex flex-wrap gap-[8px]">
            {/*
              `field-focus` carries the design's 3px halo — accent normally,
              danger while the field is reporting an error. It is unlayered in
              globals.css, so it beats `shadow-xs` and the resting border; the
              danger variant keys off `data-invalid`, which is the only hook
              that rule offers an input (its sibling matches wrappers).
            */}
            <input
              ref={inputRef}
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@potarastudio.com"
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "magic-error" : undefined}
              data-invalid={invalid ? "true" : undefined}
              className={cn(
                "field-focus h-[44px] min-w-[180px] flex-1 rounded-[10px] border border-border-input bg-bg-card px-[13px] text-[14px] text-body shadow-xs placeholder:text-muted-foreground",
                "transition-[color,border-color,box-shadow]",
              )}
            />
            <Button
              type="submit"
              variant="outline"
              size="xl"
              disabled={pending}
              className="gap-[8px] px-[15px] text-[13.5px] disabled:opacity-100 disabled:text-muted-foreground"
            >
              {pending ? (
                <>
                  <Spinner />
                  Sending…
                </>
              ) : (
                "Email me a link"
              )}
            </Button>
          </div>
          {invalid && (
            <p
              id="magic-error"
              role="alert"
              className="mt-[9px] flex gap-[7px] text-[12.5px] leading-[1.55] text-danger text-pretty"
            >
              <CircleAlert className="mt-px size-[14px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {state.message}
            </p>
          )}
        </form>
      )}
    </>
  );
}

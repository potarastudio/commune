"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

/** Email sign-in for people without a Google account (§5). Same allowlist, one-time link. */
export function MagicLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px]" role="status" aria-live="polite">
        <p className="flex items-center gap-2 font-medium">
          <Mail className="size-4 text-primary" aria-hidden="true" />
          Check your inbox
        </p>
        <p className="mt-1 text-muted-foreground">
          We sent a sign-in link to <strong className="text-foreground">{state.email}</strong>. Open it on this device. It works once and expires in an hour.
        </p>
        <form action={action} className="mt-2">
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" disabled={pending} className="text-[12px] text-link hover:underline disabled:opacity-50">
            {pending ? "Sending…" : "Send it again"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="magic-email" className="block text-[12px] font-medium text-muted-foreground">
        Email address
      </label>
      <div className="flex gap-2">
        <input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@potarastudio.com"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? "magic-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        />
        <Button type="submit" size="lg" variant="outline" className="h-11 shrink-0" disabled={pending}>
          {pending ? "Sending…" : "Email me a link"}
        </Button>
      </div>
      {state.status === "error" && (
        <p id="magic-error" role="alert" className="text-[13px] text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

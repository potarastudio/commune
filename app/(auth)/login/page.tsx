import type { Metadata } from "next";
import { GoogleIcon } from "@/components/auth/google-icon";
import { LoginPreview } from "@/components/auth/login-preview";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

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
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const err = error ? errorCopy[error] : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="flex flex-col justify-between bg-sidebar px-6 py-6 text-sidebar-foreground sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
            C
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Commune</span>
        </div>
        <div className="mt-10 hidden max-w-md lg:block">
          <LoginPreview />
        </div>
        <p className="mt-10 text-[12px] text-sidebar-muted">Potara Studio · Jakarta</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Potara Studio</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">Sign in to Commune</h1>
          <p className="mt-2 text-muted-foreground">
            Channels, threads and huddles for the studio. Use the Google account you were invited with.
          </p>

          {err && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px]"
            >
              <p className="font-medium">{err.title}</p>
              <p className="mt-0.5 text-muted-foreground">{err.body}</p>
            </div>
          )}

          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={next ?? "/"} />
            <Button type="submit" size="lg" className="h-11 w-full gap-3 text-[14px]">
              <GoogleIcon className="size-4" />
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-[12px] leading-relaxed text-muted-foreground">
            Only invited Potara accounts can sign in. Not invited yet? Ask Hakim to add your email.
          </p>
        </div>
      </section>
    </main>
  );
}

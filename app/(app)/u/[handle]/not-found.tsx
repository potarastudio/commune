import { UserRoundX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * A handle that belongs to nobody. Colocated so it renders inside the app shell
 * rather than dropping the reader onto Next's bare 404, and drawn like the
 * search page's no-results tile so the two misses read as the same kind of
 * event. `not-found.tsx` gets no params, so it cannot echo the handle back.
 */
export default function ProfileNotFound() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Profile</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pt-[18px] pb-[22px] text-center">
        <span className="grid size-10 place-items-center rounded-[11px] border border-border-subtle bg-bg-chip text-fg-600">
          <UserRoundX className="size-[17px]" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.015em] text-ink">No one has that handle</h2>
        <p className="mt-[5px] max-w-[400px] text-[13px] leading-[1.55] text-fg-600 [text-wrap:pretty]">
          They may have changed it, or they were never part of Potara. Search the studio to find who you meant.
        </p>
        <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
          <Button asChild variant="outline">
            <Link href="/search">Search messages</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to Commune</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

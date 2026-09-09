"use client";

import { Headphones } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { leaveHuddleAction } from "@/lib/actions/huddles";
import { HuddleStage } from "@/components/huddle/huddle-stage";
import { useHuddleStore } from "@/lib/store/huddle";

/**
 * Full-screen huddle view (§3). The connection lives in HuddleProvider in the
 * app shell, so this page only reads the session; opening it without one
 * (a shared link, a reload) shows a way back.
 */
export default function HuddlePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const session = useHuddleStore((s) => s.session);
  const clear = useHuddleStore((s) => s.clear);

  if (!session || session.huddleId !== roomId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Headphones className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-[20px] font-semibold tracking-tight">You&apos;re not in this huddle</h1>
          <p className="mt-2 text-muted-foreground">Join from the channel or conversation where it&apos;s running. Huddles don&apos;t survive a page reload.</p>
          <Link href="/" className="mt-5 inline-block text-[13px] font-medium text-link underline-offset-2 hover:underline">
            Back to Commune
          </Link>
        </div>
      </div>
    );
  }

  const leave = () => {
    const current = session;
    clear();
    void leaveHuddleAction({ huddleId: current.huddleId });
    router.push(current.href);
  };

  return <HuddleStage session={session} onLeave={leave} />;
}

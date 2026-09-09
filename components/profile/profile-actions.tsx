"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/actions/conversations";

/**
 * The actions on someone's profile page: open the DM, or jump to what they have
 * said. Search already understands `from:@handle`, so that link is the honest
 * way to "see their messages" without a second query path.
 */
export function ProfileActions({ userId, handle, isMe }: { userId: string; handle: string; isMe: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const message = () =>
    startTransition(async () => {
      const result = await startConversationAction({ userIds: [userId] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/dm/${result.id}`);
    });

  return (
    <div className="flex flex-wrap gap-2">
      {isMe ? (
        <Button asChild>
          <Link href="/settings">Edit your profile</Link>
        </Button>
      ) : (
        <Button type="button" disabled={pending} onClick={message}>
          {pending ? "Opening…" : "Message"}
        </Button>
      )}
      <Button asChild variant="outline">
        <Link href={`/search?q=${encodeURIComponent(`from:@${handle}`)}`}>
          {isMe ? "Your messages" : "Their messages"}
        </Link>
      </Button>
    </div>
  );
}

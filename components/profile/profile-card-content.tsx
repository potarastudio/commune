"use client";

import { Clock, MessageSquare, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/actions/conversations";
import { useProfileMap } from "@/lib/queries/profiles";
import { useIsOnline } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";
import { describeExpiry, isStatusActive, localTimeLabel } from "@/lib/utils/status";

/** The card body. Loaded on first open so message rendering never pulls in server actions. */
export function ProfileCardContent({ userId, onDone }: { userId: string; onDone: () => void }) {
  const router = useRouter();
  const profiles = useProfileMap();
  const meId = useSessionStore((s) => s.meId);
  const online = useIsOnline(userId);
  const [pending, startTransition] = useTransition();
  const p = profiles.get(userId);
  const me = meId ? profiles.get(meId) : undefined;

  if (!p) {
    return <p className="px-4 py-3 text-[13px] text-muted-foreground">{profiles.size === 0 ? "Loading…" : "This person is no longer a member."}</p>;
  }

  const isMe = p.id === meId;
  const status = isStatusActive(p) ? p : null;
  const until = status ? describeExpiry(status.status_expires_at, p.timezone) : null;
  const clock = localTimeLabel(p.timezone, me?.timezone ?? p.timezone);

  const message = () =>
    startTransition(async () => {
      const result = await startConversationAction({ userIds: [p.id] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDone();
      router.push(`/dm/${result.id}`);
    });

  return (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar className="size-16 rounded-lg">
          <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="rounded-lg bg-accent text-[22px] font-semibold text-accent-foreground">{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight tracking-tight">
            <span className="truncate">{p.display_name}</span>
            <span className={`size-2 shrink-0 rounded-full ${online ? "bg-online" : "border border-current opacity-40"}`} role="img" aria-label={online ? "Online" : "Away"} />
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">@{p.handle}</p>
          {p.title && <p className="mt-1 truncate text-[13px]">{p.title}</p>}
        </div>
      </div>

      {(status || clock) && (
        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-[13px]">
          {status && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Status</dt>
              <dd className="flex min-w-0 items-start gap-1.5">
                {status.status_emoji && (
                  <span role="img" aria-hidden="true" className="text-[15px] leading-5">
                    {status.status_emoji}
                  </span>
                )}
                <span className="min-w-0">
                  {status.status_text && <span className="block leading-5">{status.status_text}</span>}
                  {until && <span className="block text-[12px] text-muted-foreground">{until}</span>}
                </span>
              </dd>
            </div>
          )}
          {clock && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              <dt className="sr-only">Local time</dt>
              <dd>{clock} local time</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-3">
        {isMe ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/settings" onClick={onDone}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit your profile
            </Link>
          </Button>
        ) : (
          <Button type="button" size="sm" className="w-full" disabled={pending} onClick={message}>
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {pending ? "Opening…" : "Message"}
          </Button>
        )}
      </div>
    </div>
  );
}

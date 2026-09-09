"use client";

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

/**
 * The card body. Loaded on first open so message rendering never pulls in
 * server actions. Geometry from the design's profile overlay: a 56px --bg-chip
 * banner, a 56px r14 avatar hanging 24px into it, name 15/600, "@handle ·
 * title" at 12.5px, the status as a --bg-chip chip, then presence and local
 * time on one 12px line, then the action as a text-only 34px button.
 */
export function ProfileCardContent({ userId, onDone }: { userId: string; onDone: () => void }) {
  const router = useRouter();
  const profiles = useProfileMap();
  const meId = useSessionStore((s) => s.meId);
  const online = useIsOnline(userId);
  const [pending, startTransition] = useTransition();
  const p = profiles.get(userId);
  const me = meId ? profiles.get(meId) : undefined;

  if (!p) {
    return <p className="px-[16px] py-[13px] text-[12.5px] text-fg-600">{profiles.size === 0 ? "Loading…" : "This person is no longer a member."}</p>;
  }

  const isMe = p.id === meId;
  const status = isStatusActive(p) ? p : null;
  const until = status ? describeExpiry(status.status_expires_at, p.timezone) : null;
  const clock = localTimeLabel(p.timezone, me?.timezone ?? p.timezone);
  // The design draws the chip as emoji + text on one line. An emoji-only status
  // has nothing to put in it — the emoji already sits beside the name — so the
  // chip is skipped and that emoji carries the label instead of being decorative.
  const detailed = status && (status.status_text || until) ? status : null;

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
    <div>
      <div className="h-[56px] border-b border-border-subtle bg-bg-chip" aria-hidden="true" />
      <div className="px-[16px] pb-[16px]">
        <span className="-mt-[24px] block w-[56px]">
          <Avatar size="2xl">
            <AvatarImage src={p.avatar_url ?? undefined} alt="" />
            <AvatarFallback>{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </span>

        <p className="mt-[10px] flex items-center gap-[7px] text-[15px] font-semibold tracking-[-0.015em] text-ink">
          <span className="min-w-0 truncate">{p.display_name}</span>
          {status?.status_emoji && (
            <span aria-hidden={detailed ? "true" : undefined} className="shrink-0 text-[13px] leading-none">
              {!detailed && <span className="sr-only">Status: </span>}
              {status.status_emoji}
            </span>
          )}
        </p>
        <p className="mt-[2px] truncate text-[12.5px] text-muted-foreground">
          @{p.handle}
          {p.title ? ` · ${p.title}` : ""}
        </p>

        {detailed && (
          <p className="mt-[9px] flex items-start gap-[7px] rounded-[8px] border border-border-subtle bg-bg-chip px-[9px] py-[7px] text-[12.5px] text-fg-400">
            {detailed.status_emoji && (
              <span aria-hidden="true" className="shrink-0 text-[13px] leading-[1.4]">
                {detailed.status_emoji}
              </span>
            )}
            <span className="min-w-0">
              <span className="sr-only">Status: </span>
              {detailed.status_text && <span className="block leading-[1.4]">{detailed.status_text}</span>}
              {until && <span className="block text-[12px] leading-[1.4] text-tertiary">{until}</span>}
            </span>
          </p>
        )}

        <p className="mt-[9px] flex items-center gap-[6px] text-[12px] text-muted-foreground">
          <span
            aria-hidden="true"
            className={`size-[7px] shrink-0 rounded-full ${online ? "bg-presence" : "border border-tertiary bg-transparent"}`}
          />
          <span className="min-w-0 truncate">
            {online ? "Active now" : "Away"}
            {clock ? ` · ${clock} local` : ""}
          </span>
        </p>

        <div className="mt-[13px] flex gap-[7px]">
          {isMe ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings" onClick={onDone}>
                Edit your profile
              </Link>
            </Button>
          ) : (
            <Button type="button" className="w-full" disabled={pending} onClick={message}>
              {pending ? "Opening…" : "Message"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

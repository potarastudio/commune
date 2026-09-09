"use client";

import { Bell, BellOff, BellRing, Mail, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveDndAction, saveEmailDigestAction } from "@/lib/actions/profile";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push/client";

/** Browser notifications (web push) and Do Not Disturb hours (§5 Phase 2). */
export function NotificationSettings({
  dndStart,
  dndEnd,
  timezone,
  email,
  emailDigest,
}: {
  dndStart: string | null;
  dndEnd: string | null;
  timezone: string;
  email: string;
  emailDigest: boolean;
}) {
  const router = useRouter();
  const [digest, setDigest] = useState(emailDigest);
  const [digestPending, startDigest] = useTransition();
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(dndStart?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(dndEnd?.slice(0, 5) ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") toast.success("Browser notifications are on");
      else if (next === "denied") toast.error("Notifications are blocked for this site", { description: "Allow them in the browser's site settings, then try again." });
      else if (state === "on") toast.success("Browser notifications are off");
    } catch (err) {
      toast.error("Couldn't change notifications", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const saveDnd = (nextStart: string, nextEnd: string) =>
    startTransition(async () => {
      const result = await saveDndAction({ dnd_start: nextStart || null, dnd_end: nextEnd || null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });

  const dndOn = Boolean(start && end);

  const toggleDigest = () => {
    const next = !digest;
    setDigest(next);
    startDigest(async () => {
      const result = await saveEmailDigestAction({ enabled: next });
      if (!result.ok) {
        setDigest(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Email digest is on" : "Email digest is off");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            {state === "on" ? <BellRing className="size-4" aria-hidden="true" /> : state === "denied" ? <BellOff className="size-4" aria-hidden="true" /> : <Bell className="size-4" aria-hidden="true" />}
          </span>
          <div className="text-[13px]">
            <p className="font-medium">Browser notifications</p>
            <p className="text-muted-foreground">
              {state === "loading" && "Checking…"}
              {state === "unsupported" && "This browser can't show push notifications."}
              {state === "denied" && "Blocked in the browser. Allow notifications for this site to turn them on."}
              {state === "off" && "Get a notification for direct messages and mentions when Commune isn't in front."}
              {state === "on" && "On for this browser. Direct messages and mentions notify you when Commune isn't in front."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={state === "on" ? "outline" : "default"}
          disabled={busy || state === "loading" || state === "unsupported" || state === "denied"}
          onClick={() => void toggle()}
        >
          {busy ? "Working…" : state === "on" ? "Turn off" : "Turn on"}
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div className="text-[13px]">
            <p className="font-medium">Email digest</p>
            <p className="text-muted-foreground">
              {digest
                ? `Unread mentions go to ${email} once you've been away 15 minutes. Quiet hours apply.`
                : "Off. Mentions you miss while away stay in Activity only."}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant={digest ? "outline" : "default"} disabled={digestPending} onClick={toggleDigest} aria-pressed={digest}>
          {digestPending ? "Saving…" : digest ? "Turn off" : "Turn on"}
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <Moon className="size-4" aria-hidden="true" />
          </span>
          <div className="flex-1 text-[13px]">
            <p className="font-medium">Do Not Disturb</p>
            <p className="text-muted-foreground">
              {dndOn ? `No notifications between ${start} and ${end}` : "Set quiet hours to pause notifications"} · {timezone.replace(/_/g, " ")}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="dnd-start" className="text-[12px]">
                  From
                </Label>
                <input
                  id="dnd-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dnd-end" className="text-[12px]">
                  Until
                </Label>
                <input
                  id="dnd-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                />
              </div>
              <Button type="button" size="sm" disabled={pending || (Boolean(start) !== Boolean(end))} onClick={() => saveDnd(start, end)}>
                {pending ? "Saving…" : "Save hours"}
              </Button>
              {dndOn && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setStart("");
                    setEnd("");
                    saveDnd("", "");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

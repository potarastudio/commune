"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveDndAction, saveEmailDigestAction } from "@/lib/actions/profile";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push/client";

/** The design's settings row: label + note on the left, one control on the right. No iconography. */
const ROW = "flex flex-wrap items-center gap-4 px-4 py-[14px]";
const LABEL = "block text-[13.5px] font-semibold text-ink";
const NOTE = "mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600";
const TIME_FIELD =
  "field-focus h-[34px] rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13px] font-medium text-ink shadow-xs outline-none";

/**
 * The 38×22 pill switch the Settings design uses for every boolean — 1px
 * --accent-border over --accent when on, --border-input over --bg-chip when
 * off, with a 16px white knob that slides to the end.
 */
function Switch({
  checked,
  disabled,
  label,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full border p-[2px] transition-colors disabled:pointer-events-none disabled:opacity-50 ${
        checked ? "justify-end border-accent-border bg-primary" : "justify-start border-border-input bg-bg-chip"
      }`}
    >
      <span aria-hidden="true" className="block size-[16px] rounded-full bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.25)]" />
    </button>
  );
}

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
    <div className="overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs">
      <div className="divide-y divide-border-subtle">
        <div className={ROW}>
          <span className="min-w-[180px] flex-1">
            <span className={LABEL}>Browser notifications</span>
            <span className={NOTE}>
              {state === "loading" && "Checking…"}
              {state === "unsupported" && "This browser can't show push notifications."}
              {state === "denied" && "Blocked in the browser. Allow notifications for this site to turn them on."}
              {state === "off" && "Get a notification for direct messages and mentions when Commune isn't in front."}
              {state === "on" && "On for this browser. Direct messages and mentions notify you when Commune isn't in front."}
            </span>
          </span>
          <Switch
            checked={state === "on"}
            disabled={busy || state === "loading" || state === "unsupported" || state === "denied"}
            label="Browser notifications"
            onClick={() => void toggle()}
          />
        </div>

        <div className={ROW}>
          <span className="min-w-[180px] flex-1">
            <span className={LABEL}>Email digest</span>
            <span className={NOTE}>
              {digest
                ? `Unread mentions go to ${email} once you've been away 15 minutes. Quiet hours apply.`
                : "Off. Mentions you miss while away stay in Activity only."}
            </span>
          </span>
          <Switch checked={digest} disabled={digestPending} label="Email digest" onClick={toggleDigest} />
        </div>

        <div className="px-4 py-[14px]">
          <span className="block">
            <span className={LABEL}>Do Not Disturb</span>
            <span className={NOTE}>
              {dndOn ? `No notifications between ${start} and ${end}` : "Set quiet hours to pause notifications"} ·{" "}
              {timezone.replace(/_/g, " ")}
            </span>
          </span>

          <div className="mt-3 flex flex-wrap items-end gap-[7px]">
            <span className="flex flex-col gap-[6px]">
              <Label htmlFor="dnd-start">From</Label>
              <input id="dnd-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={TIME_FIELD} />
            </span>
            <span className="flex flex-col gap-[6px]">
              <Label htmlFor="dnd-end">Until</Label>
              <input id="dnd-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={TIME_FIELD} />
            </span>
            <Button
              type="button"
              size="sm"
              disabled={pending || Boolean(start) !== Boolean(end)}
              onClick={() => saveDnd(start, end)}
            >
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
  );
}

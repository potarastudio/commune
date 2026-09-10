"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setNotificationLevelAction } from "@/lib/actions/channels";
import { saveDndAction, saveEmailDigestAction } from "@/lib/actions/profile";
import type { NotificationLevel } from "@/lib/queries/channels";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push/client";
import { humanError } from "@/lib/utils/human-error";

/** The design's settings row: label + note on the left, one control on the right. No iconography. */
const ROW = "flex flex-wrap items-center gap-4 px-4 py-[14px]";
const LABEL = "block text-[13.5px] font-semibold text-ink";
const NOTE = "mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600";
const TIME_FIELD =
  "field-focus h-[34px] rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13px] font-medium text-ink shadow-xs outline-none";

/**
 * "Notify me about" — the design's three radio cards (10px radius, 18px radio,
 * the selected one on --accent-surface with an --accent-fg description).
 *
 * The only notification preference Commune stores is `channel_members
 * .notification_level`, whose three values are exactly these three choices, so
 * this is the bulk control for it: picking one writes it to every channel you
 * have joined, and the per-channel rows further down still set one at a time.
 * When those rows disagree no card is selected and the group says so, rather
 * than lying about a single value. The design's fourth idea on this page —
 * notification keywords — has no column behind it and is deliberately absent.
 */
const NOTIFY_OPTIONS: { value: NotificationLevel; label: string; note: string }[] = [
  { value: "all", label: "All new messages", note: "Every message in every channel you have joined." },
  { value: "mentions", label: "Mentions", note: "Only @you, @channel and @here. Direct messages always come through." },
  { value: "muted", label: "Nothing", note: "Channels stop badging and stop going bold. Direct messages still reach you." },
];

export function NotifyAbout({ channels }: { channels: { id: string; notification_level: NotificationLevel }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const levels = new Set(channels.map((c) => c.notification_level));
  const shared = levels.size === 1 ? ([...levels][0] ?? null) : null;
  const [optimistic, setOptimistic] = useOptimistic(shared);
  const empty = channels.length === 0;

  const choose = (value: NotificationLevel) => {
    if (empty || value === optimistic) return;
    startTransition(async () => {
      setOptimistic(value);
      const results = await Promise.all(channels.map((c) => setNotificationLevelAction({ channelId: c.id, level: value })));
      for (const result of results) {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }
      toast.success(`Every channel is set to “${NOTIFY_OPTIONS.find((o) => o.value === value)?.label}”`);
      router.refresh();
    });
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Notify me about" className={`flex flex-col gap-2 ${pending ? "opacity-70" : ""}`}>
        {NOTIFY_OPTIONS.map((o) => {
          const active = optimistic === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={empty}
              onClick={() => choose(o.value)}
              className={`flex items-start gap-[10px] rounded-[10px] border px-[13px] py-3 text-left transition-colors disabled:cursor-not-allowed ${
                active
                  ? "border-primary bg-accent-surface"
                  : "border-border-strong bg-bg-card hover:border-border-hover hover:bg-bg-card-hover"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] bg-bg-card ${
                  active ? "border-primary" : "border-border-input"
                }`}
              >
                <span className={`block size-[10px] rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
              </span>
              <span className="min-w-0">
                <span className={LABEL}>{o.label}</span>
                <span className={`mt-[2px] block text-[12.5px] leading-[1.45] ${active ? "text-accent-foreground" : "text-fg-600"}`}>
                  {o.note}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {(empty || !optimistic) && (
        <p className="mt-[9px] text-[12px] leading-[1.5] text-muted-foreground">
          {empty
            ? "You haven't joined a channel yet, so there is nothing to set."
            : "Your channels are set differently right now. Choosing one applies it to all of them."}
        </p>
      )}
    </div>
  );
}

/**
 * The 38×22 pill switch the Settings design uses for every boolean — 1px
 * --accent-border over --accent when on, --border-input over --bg-chip when
 * off, with a 16px white knob that slides to the end.
 *
 * A disabled switch keeps that off-state at full strength: the design has no
 * disabled recipe for it, and the blanket half-opacity it used to take left a
 * #fafafa track on a #ffffff card — no visible control at all. The row's own
 * copy says why it can't be used ("Blocked in the browser…"), the native
 * `disabled` carries the state to assistive tech, and the cursor says the rest.
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
      className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full border p-[2px] transition-colors disabled:cursor-not-allowed ${
        checked ? "justify-end border-accent-border bg-primary" : "justify-start border-border-input bg-bg-chip"
      }`}
    >
      <span
        aria-hidden="true"
        className={`block size-[16px] rounded-full bg-white ${disabled ? "shadow-none" : "shadow-[0_1px_2px_0_rgba(0,0,0,0.25)]"}`}
      />
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
      toast.error("Couldn't change notifications", { description: humanError(err, "Try again in a moment.") });
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
                ? `Unread mentions go to ${email} once you've been away 15 minutes. Do Not Disturb applies.`
                : "Off. Mentions you miss while away stay in Activity only."}
            </span>
          </span>
          <Switch checked={digest} disabled={digestPending} label="Email digest" onClick={toggleDigest} />
        </div>

        <div className="px-4 py-[14px]">
          <span className="block">
            <span className={LABEL}>Do Not Disturb</span>
            <span className={NOTE}>
              {dndOn ? `No notifications between ${start} and ${end}` : "Set hours to pause notifications"} ·{" "}
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

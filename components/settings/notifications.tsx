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
import { inDoNotDisturb } from "@/lib/push/dnd";
import { humanError } from "@/lib/utils/human-error";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { SettingsGroup } from "@/components/mobile/you-screen";
import { nativePlatform } from "@/lib/native";
import { SoundRow } from "./sound-row";

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

export function NotifyAbout({
  channels,
  variant = "desktop",
  handle,
}: {
  channels: { id: string; notification_level: NotificationLevel }[];
  /** The phone draws the three choices as rows in a grouped card (design: Mobile Core Screens → Notifications). */
  variant?: "desktop" | "mobile";
  handle?: string;
}) {
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

  if (variant === "mobile") {
    const mobileNotes: Record<NotificationLevel, string> = {
      all: "Every message in every channel you have joined.",
      mentions: `When someone types @${handle ?? "you"}, @channel or @here, or messages you directly.`,
      muted: "Channels stop badging and going bold. Direct messages still reach you.",
    };
    return (
      <div role="radiogroup" aria-label="Notify me about" className={pending ? "opacity-70" : undefined}>
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
              className="flex w-full items-start gap-[12px] border-t border-border-subtle px-[16px] py-[13px] text-left active:bg-bg-hover disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className={`mt-px grid size-[20px] shrink-0 place-items-center rounded-full border-[1.5px] bg-bg-card ${
                  active ? "border-primary" : "border-border-input"
                }`}
              >
                <span className={`block size-[11px] rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14.5px] text-ink ${active ? "font-semibold" : "font-medium"}`}>
                  {o.value === "mentions" ? "Mentions and direct messages" : o.label}
                </span>
                <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600 [text-wrap:pretty]">{mobileNotes[o.value]}</span>
              </span>
            </button>
          );
        })}
        {(empty || !optimistic) && (
          <p className="border-t border-border-subtle px-[16px] py-[11px] text-[12.5px] leading-[1.5] text-muted-foreground">
            {empty
              ? "You haven't joined a channel yet, so there is nothing to set."
              : "Your channels are set differently right now. Choosing one applies it to all of them."}
          </p>
        )}
      </div>
    );
  }

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
  size = "desktop",
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  /** The phone's switch is 46×28 with a 22px knob, a thumb's worth. */
  size?: "desktop" | "mobile";
}) {
  if (size === "mobile") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`flex h-[28px] w-[46px] shrink-0 items-center rounded-full border p-[2px] transition-colors disabled:cursor-not-allowed ${
          checked ? "justify-end border-accent-border bg-primary" : "justify-start border-border-input bg-bg-chip"
        }`}
      >
        <span aria-hidden="true" className="block size-[22px] rounded-full bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.3)]" />
      </button>
    );
  }
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
  variant = "desktop",
}: {
  dndStart: string | null;
  dndEnd: string | null;
  timezone: string;
  email: string;
  emailDigest: boolean;
  /** The phone splits these into grouped cards: this device, the schedule, email. */
  variant?: "desktop" | "mobile";
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
  // After hydration only: whether the clock says quiet depends on the moment,
  // and the server rendered this a moment earlier.
  const hydrated = useHydrated();
  const quietNow = hydrated && dndOn && inDoNotDisturb({ dnd_start: start, dnd_end: end, timezone });

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

  if (variant === "mobile") {
    const platform = hydrated ? nativePlatform() : null;
    const pushNote =
      state === "loading"
        ? "Checking…"
        : state === "unsupported"
          ? "This browser can't show notifications. The Commune app can."
          : state === "denied"
            ? platform
              ? `Off at the system level — turn on in ${platform === "ios" ? "iOS" : "Android"} Settings.`
              : "Blocked in the browser. Allow notifications for this site to turn them on."
            : state === "on"
              ? "Direct messages and mentions reach this phone when Commune isn't open."
              : "Get direct messages and mentions on this phone when Commune isn't open.";
    const MROW = "flex min-h-[52px] items-center gap-[14px] border-t border-border-subtle px-[16px] py-[11px]";
    const MLABEL = "block text-[14.5px] font-medium text-ink";
    const MNOTE = "mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600 [text-wrap:pretty]";
    // iOS gives time fields an intrinsic width wider than half a phone; min-w-0 and no native
    // appearance let the grid size them, and the value sits left like the design's fields.
    const MFIELD =
      "field-focus block h-[44px] w-full min-w-0 appearance-none rounded-[10px] border border-border-input bg-bg-card px-[12px] text-left text-[15px] font-medium text-ink outline-none [&::-webkit-date-and-time-value]:text-left";
    return (
      <>
        <SettingsGroup title="On this device" className="mt-[16px]">
          <div className={MROW}>
            <span className="min-w-0 flex-1">
              <span className={MLABEL}>Push notifications</span>
              <span className={MNOTE}>{pushNote}</span>
            </span>
            <Switch
              size="mobile"
              checked={state === "on" || state === "desktop"}
              disabled={busy || state === "loading" || state === "unsupported" || state === "denied" || state === "desktop"}
              label="Push notifications"
              onClick={() => void toggle()}
            />
          </div>
          <SoundRow variant="mobile" />
        </SettingsGroup>

        <SettingsGroup title="Schedule" className="mt-[16px]">
          <div className="border-t border-border-subtle px-[16px] py-[13px]">
            <span className={MLABEL}>Do Not Disturb</span>
            <span className={MNOTE}>
              {quietNow ? `Quiet now — nothing rings until ${end}` : dndOn ? `Quiet between ${start} and ${end}` : "Set hours to pause notifications"} ·{" "}
              {timezone.replace(/_/g, " ")}
            </span>
            <div className="mt-[12px] grid grid-cols-2 gap-[10px]">
              <span className="flex min-w-0 flex-col gap-[6px]">
                <Label htmlFor="dnd-start-m">From</Label>
                <input id="dnd-start-m" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={MFIELD} />
              </span>
              <span className="flex min-w-0 flex-col gap-[6px]">
                <Label htmlFor="dnd-end-m">Until</Label>
                <input id="dnd-end-m" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={MFIELD} />
              </span>
            </div>
            <div className="mt-[12px] flex gap-[10px]">
              <Button
                type="button"
                disabled={pending || Boolean(start) !== Boolean(end)}
                onClick={() => saveDnd(start, end)}
                className="h-[44px] flex-1 rounded-[11px] text-[14px]"
              >
                {pending ? "Saving…" : "Save hours"}
              </Button>
              {dndOn && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="h-[44px] rounded-[11px] px-[16px] text-[14px]"
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
        </SettingsGroup>

        <SettingsGroup title="Email" className="mt-[16px]">
          <div className={MROW}>
            <span className="min-w-0 flex-1">
              <span className={MLABEL}>Email digest</span>
              <span className={MNOTE}>
                {digest ? `Unread mentions go to ${email} once you've been away 15 minutes.` : "Off. Mentions you miss stay in Activity."}
              </span>
            </span>
            <Switch size="mobile" checked={digest} disabled={digestPending} label="Email digest" onClick={toggleDigest} />
          </div>
        </SettingsGroup>
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs">
      <div className="divide-y divide-border-subtle">
        <SoundRow />
        <div className={ROW}>
          <span className="min-w-[180px] flex-1">
            <span className={LABEL}>{state === "desktop" ? "Desktop notifications" : "Browser notifications"}</span>
            <span className={NOTE}>
              {state === "loading" && "Checking…"}
              {state === "desktop" && "On. The desktop app notifies you about direct messages and mentions while it is running and not in front."}
              {state === "unsupported" && "This browser can't show push notifications."}
              {state === "denied" && "Blocked in the browser. Allow notifications for this site to turn them on."}
              {state === "off" && "Get a notification for direct messages and mentions when Commune isn't in front."}
              {state === "on" && "On for this browser. Direct messages and mentions notify you when Commune isn't in front."}
            </span>
          </span>
          <Switch
            checked={state === "on" || state === "desktop"}
            disabled={busy || state === "loading" || state === "unsupported" || state === "denied" || state === "desktop"}
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
              {quietNow ? `Quiet now — nothing rings until ${end}` : dndOn ? `No notifications between ${start} and ${end}` : "Set hours to pause notifications"} ·{" "}
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

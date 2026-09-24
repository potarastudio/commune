"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isNativeApp, native } from "@/lib/native";
import { enablePush, refreshNativePush } from "@/lib/push/client";
import { humanError } from "@/lib/utils/human-error";
import { Sheet } from "./sheet";

const ASKED_KEY = "commune-push-primed";
/** Long enough to have seen the app first, so the question has something to be about. */
const DELAY_MS = 2500;

/**
 * Asked in the app before the system prompt (design: Mobile System States →
 * Permission priming), saying exactly what will be sent. The system dialog
 * can be shown once; it is spent only after a yes here. Asked once — after
 * that the switch lives in You → Notifications.
 */
export function PushPrimer() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    // Push that was already on keeps its token current.
    void refreshNativePush();
    let asked = false;
    try {
      asked = window.localStorage.getItem(ASKED_KEY) !== null;
    } catch {
      asked = true;
    }
    if (asked) return;
    const timer = setTimeout(() => {
      void native.push.permission().then((p) => {
        if (p === "prompt") setOpen(true);
      });
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const settle = () => {
    try {
      window.localStorage.setItem(ASKED_KEY, new Date().toISOString());
    } catch {
      // Asking again next launch is the worst case.
    }
    setOpen(false);
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const state = await enablePush();
      if (state === "on") toast.success("Notifications are on");
      else if (state === "denied") toast("Notifications stay off", { description: "You can turn them on in the phone's Settings any time." });
    } catch (err) {
      toast.error("Couldn't turn on notifications", { description: humanError(err, "Try again from You → Notifications.") });
    } finally {
      setBusy(false);
      settle();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : settle())} title="Turn on notifications">
      <div className="px-[20px] pb-[10px]">
        <span className="mt-[12px] grid size-[52px] shrink-0 place-items-center rounded-[15px] border border-accent-surface-border bg-accent-surface text-accent-foreground">
          <Bell className="size-[24px]" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="mt-[15px] text-[20px] font-semibold tracking-[-0.025em] text-ink [text-wrap:pretty]">Get told when someone needs you</h2>
        <p className="mt-[8px] text-[14px] leading-[1.6] text-fg-600 [text-wrap:pretty]">
          Direct messages, @mentions, and any channel you have set to All new messages. Muted channels and your quiet hours stay silent.
        </p>
        <div className="mt-[18px] flex flex-col gap-[9px]">
          <button
            type="button"
            disabled={busy}
            onClick={() => void turnOn()}
            className="flex h-[48px] items-center justify-center rounded-[12px] border border-accent-border bg-primary text-[15px] font-semibold text-white shadow-[0_1px_2px_0_var(--shadow-tint-md),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-60"
          >
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
          <button type="button" onClick={settle} className="flex h-[48px] items-center justify-center rounded-[12px] text-[15px] font-semibold text-fg-600">
            Not now
          </button>
        </div>
      </div>
    </Sheet>
  );
}

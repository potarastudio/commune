"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { isNativeApp, native } from "@/lib/native";
import { useMobileNavStore } from "@/lib/store/mobile-nav";

/** Paths a `commune://` link or a notification may open inside the app: this origin only. */
export function safeAppPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

/*
 * A cold launch reports its link twice — once from getLaunchUrl and once as an
 * event — and getLaunchUrl keeps returning it after the page reloads. The links
 * already acted on are remembered for the session, so a sign-in handoff is
 * claimed once and a reload never loops back into it.
 */
const HANDLED_KEY = "commune-handled-links";
function firstTime(link: string): boolean {
  try {
    const seen = new Set<string>(JSON.parse(window.sessionStorage.getItem(HANDLED_KEY) ?? "[]") as string[]);
    if (seen.has(link)) return false;
    seen.add(link);
    window.sessionStorage.setItem(HANDLED_KEY, JSON.stringify([...seen].slice(-20)));
    return true;
  } catch {
    return true;
  }
}

/**
 * The phone app's native events that matter on every page, signed in or not:
 * the `commune://` links (the sign-in handoff arrives while the app is still
 * on /login), notification taps, the keyboard and the status bar. Mounted in
 * the root layout; in a browser it does nothing.
 */
export function NativeBridge() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isNativeApp()) return;

    const open = (path: string) => {
      useMobileNavStore.getState().arriveFromOutside(path);
      router.replace(path);
    };

    // commune://auth?handoff=<id> — the browser finished signing in and hands the session over.
    // commune://open?path=/channel/… — anything else that wants a screen opened.
    const handle = (raw: string | null) => {
      if (!raw || !firstTime(raw)) return;
      let link: URL;
      try {
        link = new URL(raw);
      } catch {
        return;
      }
      const handoff = link.searchParams.get("handoff");
      if (link.host === "auth" && handoff) {
        native.closeBrowser();
        void fetch("/api/desktop/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handoff }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Sign-in didn't finish.");
            window.location.replace("/");
          })
          .catch((err: Error) => toast.error("Couldn't sign you in", { description: err.message }));
        return;
      }
      const path = safeAppPath(link.searchParams.get("path"));
      if (path) open(path);
    };

    void native.launchUrl().then(handle);
    const offLinks = native.onAppUrlOpen(handle);
    // A tapped notification opens its conversation in its own tab, with Back leading into the app.
    const offPush = native.push.onOpen((raw) => {
      const path = safeAppPath(raw);
      if (path) open(path);
    });
    // The home-indicator inset belongs under the tab bar and composer, not between them and the keyboard.
    const offKeyboard = native.onKeyboard((kb) => document.documentElement.classList.toggle("kb-open", kb));
    return () => {
      offLinks();
      offPush();
      offKeyboard();
    };
  }, [router]);

  // Status bar text follows the theme.
  useEffect(() => {
    if (resolvedTheme) native.setStatusBar(resolvedTheme === "dark");
  }, [resolvedTheme]);

  return null;
}

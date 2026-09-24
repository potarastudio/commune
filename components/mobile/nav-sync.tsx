"use client";

import { useEffect, useLayoutEffect } from "react";
import { isSurface } from "@/lib/mobile";
import { native } from "@/lib/native";
import { useMobileNavStore } from "@/lib/store/mobile-nav";
import { commitNavigation } from "@/lib/view-transition";
import { useCurrentUrl, useMobileNav } from "./use-mobile-nav";

/**
 * Keeps the per-tab stacks in step with the address bar, and connects the
 * phone app's navigation gestures: Android's back button and the iOS edge
 * swipe. Links, notification taps, the keyboard and the status bar are the
 * root layout's NativeBridge, since they matter before sign-in too. Renders
 * nothing.
 */
export function NavSync() {
  const url = useCurrentUrl();
  const nav = useMobileNav();
  const apply = useMobileNavStore((s) => s.apply);

  // Every URL change, however it happened, updates the stacks; a waiting push
  // or pop animation can then capture the new screen.
  useLayoutEffect(() => {
    apply(url);
    commitNavigation();
  }, [url, apply]);

  // Remember what this screen is called once its title has landed.
  useEffect(() => {
    const t = setTimeout(() => {
      const title = document.title.replace(/ · Commune$/, "").trim();
      if (title && title !== "Commune") useMobileNavStore.getState().setTitle(url, title);
    }, 400);
    return () => clearTimeout(t);
  }, [url]);

  // iOS's edge swipe walks the WebView's history, so it is only on when that
  // history's previous entry is this tab's previous screen.
  const swipeOk = useMobileNavStore((s) => {
    const stack = s.active ? s.stacks[s.active] : [];
    const top = stack[stack.length - 1];
    return stack.length > 1 && Boolean(top?.viaPush) && top?.url === url;
  });
  useEffect(() => {
    native.setSwipeBack(swipeOk && !isSurface(url));
  }, [swipeOk, url]);

  // Android: back walks the tab; at a tab's root it leaves the app, as Android apps do.
  useEffect(() => native.onBackButton(() => {
    if (!nav.back()) native.minimize();
  }), [nav]);

  return null;
}

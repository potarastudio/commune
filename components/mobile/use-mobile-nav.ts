"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { backTarget, isSurface, rootTabOf, TAB_ROOTS, type MobileTab } from "@/lib/mobile";
import { useMobileNavStore } from "@/lib/store/mobile-nav";
import { navigateWithTransition } from "@/lib/view-transition";

/** Tapping the tab you are already on at its root scrolls it to the top; screens listen for this. */
export const SCROLL_TO_TOP_EVENT = "commune:scroll-to-top";

/** The current URL as the app routes on it: path plus query, no origin. */
export function useCurrentUrl(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Moving around the phone app (design: Mobile Navigation). Push a screen onto
 * the current tab, go back within it, switch tabs without losing any tab's
 * place, and open or close the full-screen surfaces. Links that do not go
 * through here still work — the NavSync infers what they did — they just do
 * not animate.
 */
export function useMobileNav() {
  const router = useRouter();

  return useMemo(() => {
    const store = useMobileNavStore;
    const current = () => (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`);

    /** Leaves search, a new message or a huddle for the screen underneath. */
    const closeSurface = () => {
      const state = store.getState();
      const surface = state.surface;
      state.setSurface(null);
      if (surface?.viaPush) {
        router.back();
        return;
      }
      const active = state.active ?? "channels";
      const stack = state.stacks[active];
      router.replace(stack[stack.length - 1]?.url ?? TAB_ROOTS[active], { scroll: false });
    };

    /**
     * Leaves a surface for the screen it produced — the conversation a new
     * message opened. It replaces the surface in history and lands in its own
     * tab, on top of that tab's root, so Back leads into the app.
     */
    const replaceSurface = (url: string) => {
      const state = store.getState();
      state.setSurface(null);
      state.arriveFromOutside(url);
      router.replace(url, { scroll: false });
    };

    const push = (url: string) => {
      if (url === current()) return;
      if (isSurface(url)) {
        store.getState().setSurface({ from: current(), viaPush: true });
        router.push(url, { scroll: false });
        return;
      }
      store.getState().setIntent({ kind: "push", url });
      navigateWithTransition("push", () => router.push(url, { scroll: false }));
    };

    /** Back within the active tab. Returns false at a tab root, where there is nowhere to go. */
    const back = (): boolean => {
      const state = store.getState();
      if (isSurface(current())) {
        closeSurface();
        return true;
      }
      const target = backTarget(state);
      if (!target || !state.active) return false;
      const stack = state.stacks[state.active];
      const top = stack[stack.length - 1];
      state.setIntent({ kind: "back", url: target });
      // History mirrors the stack only when this screen was pushed from the one below it.
      navigateWithTransition("pop", () => (top?.viaPush ? router.back() : router.replace(target, { scroll: false })));
      return true;
    };

    const switchTab = (tab: MobileTab) => {
      const state = store.getState();
      const here = current();
      const stack = state.stacks[tab];
      if (state.active === tab && !isSurface(here)) {
        if (stack.length > 1) {
          state.setIntent({ kind: "reset", tab, url: TAB_ROOTS[tab] });
          navigateWithTransition("pop", () => router.replace(TAB_ROOTS[tab], { scroll: false }));
        } else {
          window.dispatchEvent(new CustomEvent(SCROLL_TO_TOP_EVENT, { detail: tab }));
        }
        return;
      }
      const top = stack[stack.length - 1]?.url ?? TAB_ROOTS[tab];
      state.setIntent({ kind: "tab", tab, url: top });
      router.replace(top, { scroll: false });
    };

    /** Whether the screen at `url` has somewhere to go back to: a pushed screen or a surface. */
    const canGoBack = (url: string): boolean => isSurface(url) || rootTabOf(url) === null;

    return { push, back, switchTab, closeSurface, replaceSurface, canGoBack };
  }, [router]);
}

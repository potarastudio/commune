"use client";

/**
 * The phone's push and pop (design: Mobile Navigation → Push). The incoming
 * screen slides in over the one behind, which parallaxes a third of the way and
 * dims — the depth cue that says Back exists. Built on the View Transitions
 * API: the browser snapshots the old screen, we navigate, and it animates to
 * the new one. Where the API is missing, or motion is reduced, the navigation
 * simply happens.
 *
 * The animation waits for the new route to commit. `commitNavigation()` is
 * called by the mobile NavSync once the address bar has changed; a timeout
 * makes sure a slow route never holds the old frame on screen.
 */
export type NavDirection = "push" | "pop" | "none";

let resolveCommit: (() => void) | null = null;
const HOLD_LIMIT_MS = 700;

export function commitNavigation(): void {
  resolveCommit?.();
  resolveCommit = null;
}

type DocumentWithTransitions = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

export function navigateWithTransition(direction: NavDirection, navigate: () => void): void {
  const doc = document as DocumentWithTransitions;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (direction === "none" || reduced || !doc.startViewTransition) {
    navigate();
    return;
  }
  // A transition already waiting is abandoned in favour of this one.
  commitNavigation();
  document.documentElement.dataset.nav = direction;
  try {
    const transition = doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          resolveCommit = resolve;
          navigate();
          setTimeout(() => {
            if (resolveCommit === resolve) commitNavigation();
          }, HOLD_LIMIT_MS);
        }),
    );
    void transition.finished.finally(() => {
      if (document.documentElement.dataset.nav === direction) delete document.documentElement.dataset.nav;
    });
  } catch {
    delete document.documentElement.dataset.nav;
    navigate();
  }
}

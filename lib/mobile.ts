/**
 * The phone interface (design: Commune Mobile *.dc.html).
 *
 * Phones get a different app shell: five tab stacks instead of a sidebar,
 * pushed screens with a back button, full-screen surfaces for search, new
 * messages and huddles. Which shell to render is decided on the server from
 * the user agent, so the HTML already has the right one and nothing swaps
 * after hydration. Tablets and desktops keep the desktop shell.
 *
 * Everything here is pure, so the navigation rules can be unit tested.
 */

/** The native app appends `CommuneMobile/<version>` to its WebView's user agent (see mobile/). */
export function isNativeAppUserAgent(ua: string | null | undefined): boolean {
  return Boolean(ua && /\bCommuneMobile\//.test(ua));
}

/** iPhones and Android phones. iPads and Android tablets report no "Mobile" token and keep the desktop shell. */
export function isPhoneUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (isNativeAppUserAgent(ua)) return true;
  if (/iPad|Tablet/i.test(ua)) return false;
  return /\b(iPhone|iPod)\b/.test(ua) || /\bMobile\b/.test(ua);
}

// ---- Navigation model ----------------------------------------------------------

export const MOBILE_TABS = ["channels", "activity", "dms", "saved", "you"] as const;
export type MobileTab = (typeof MOBILE_TABS)[number];

/** Each tab's root screen. Everything else is pushed on top of one of these. */
export const TAB_ROOTS: Record<MobileTab, string> = {
  channels: "/",
  activity: "/activity",
  dms: "/dm",
  saved: "/saved",
  you: "/settings",
};

/** One screen in a tab's history. `viaPush`: the browser history entry before it is the entry below it in this stack. */
export type StackEntry = { url: string; viaPush: boolean };
export type Stacks = Record<MobileTab, StackEntry[]>;
export type NavState = { active: MobileTab | null; stacks: Stacks };

export function emptyStacks(): Stacks {
  return Object.fromEntries(MOBILE_TABS.map((t) => [t, [{ url: TAB_ROOTS[t], viaPush: false }]])) as Stacks;
}

/** Split a URL the app routes on into its path and its query, without the origin or a trailing `?`. */
function parts(url: string): { path: string; params: URLSearchParams } {
  const q = url.indexOf("?");
  return q === -1 ? { path: url, params: new URLSearchParams() } : { path: url.slice(0, q), params: new URLSearchParams(url.slice(q + 1)) };
}

/** The tab whose root this URL is, or null. `/settings?section=notifications` is pushed inside You, not its root. */
export function rootTabOf(url: string): MobileTab | null {
  const { path, params } = parts(url);
  for (const tab of MOBILE_TABS) {
    if (path !== TAB_ROOTS[tab]) continue;
    // A section, a query or a filter makes it a screen inside the tab, except Activity and
    // Saved filters, which are the root itself showing a different slice.
    if (tab === "you" && params.has("section")) return null;
    return tab;
  }
  return null;
}

/**
 * Full-screen surfaces cover the tabs and close rather than pop: search, a new
 * message, a huddle. They are never entries in a tab's stack.
 */
export function isSurface(url: string): boolean {
  const { path } = parts(url);
  return path === "/search" || path === "/dm/new" || path.startsWith("/huddle/");
}

/** The tab a URL belongs to when nothing else says: a cold start or a notification. */
export function defaultTabFor(url: string): MobileTab {
  const root = rootTabOf(url);
  if (root) return root;
  const { path } = parts(url);
  if (path.startsWith("/dm/")) return "dms";
  if (path === "/settings" || path === "/channels") return "you";
  return "channels";
}

/**
 * The screens under a URL that was reached directly, so Back leads somewhere
 * sensible instead of out of the app: a thread sits on its conversation, which
 * sits on the tab's root.
 */
export function synthesizeStack(url: string): { tab: MobileTab; stack: StackEntry[] } {
  const tab = defaultTabFor(url);
  const root = TAB_ROOTS[tab];
  const entries = [root];
  const { path, params } = parts(url);
  if (url !== root) {
    if (params.has("thread") && path !== root) entries.push(path);
    entries.push(url);
  }
  return { tab, stack: entries.map((u) => ({ url: u, viaPush: false })) };
}

/** What the app itself asked for, so the URL change it causes is applied as that and not guessed at. */
export type Intent =
  | { kind: "push"; url: string }
  | { kind: "back"; url: string }
  | { kind: "tab"; tab: MobileTab; url: string }
  | { kind: "reset"; tab: MobileTab; url: string };

/**
 * The stacks after the address bar changed to `url`.
 *
 * With an intent the app knows what happened. Without one — a link, the
 * browser's back button, a reload, a notification — it infers: a tab root
 * resets that tab; a URL already in the active stack is a step back to it;
 * anything else is pushed onto the active tab, and on a cold start the stack
 * is synthesised.
 */
export function applyNavigation(state: NavState, url: string, intent: Intent | null): NavState {
  if (isSurface(url)) return state;
  const stacks = { ...state.stacks };

  if (intent && intent.url === url) {
    switch (intent.kind) {
      case "push": {
        const tab = state.active ?? defaultTabFor(url);
        stacks[tab] = [...stacks[tab], { url, viaPush: true }];
        return { active: tab, stacks };
      }
      case "back": {
        const tab = state.active ?? defaultTabFor(url);
        const at = stacks[tab].findIndex((e) => e.url === url);
        stacks[tab] = at === -1 ? synthesizeStack(url).stack : stacks[tab].slice(0, at + 1);
        return { active: tab, stacks };
      }
      case "tab": {
        // History no longer mirrors this stack: the entry before is another tab's screen.
        const stack = stacks[intent.tab];
        stacks[intent.tab] = stack.map((e, i) => (i === stack.length - 1 ? { ...e, viaPush: false } : e));
        return { active: intent.tab, stacks };
      }
      case "reset": {
        stacks[intent.tab] = [{ url, viaPush: false }];
        return { active: intent.tab, stacks };
      }
    }
  }

  const root = rootTabOf(url);
  if (root) {
    const stack = stacks[root];
    // Arriving on a root that is already its tab's only screen changes nothing.
    stacks[root] = stack.length === 1 && stack[0].url === url ? stack : [{ url, viaPush: false }];
    return { active: root, stacks };
  }

  if (state.active) {
    const stack = stacks[state.active];
    const at = stack.findIndex((e) => e.url === url);
    if (at !== -1) {
      stacks[state.active] = stack.slice(0, at + 1);
      return { active: state.active, stacks };
    }
    // The same conversation with a different query (a jump to a message, a panel) replaces the top.
    const top = stack[stack.length - 1];
    if (top && parts(top.url).path === parts(url).path && !parts(url).params.has("thread") && !parts(top.url).params.has("thread")) {
      stacks[state.active] = [...stack.slice(0, -1), { url, viaPush: top.viaPush }];
      return { active: state.active, stacks };
    }
    stacks[state.active] = [...stack, { url, viaPush: true }];
    return { active: state.active, stacks };
  }

  const { tab, stack } = synthesizeStack(url);
  stacks[tab] = stack;
  return { active: tab, stacks };
}

/** The screen Back leads to from the active tab's top, or null at a root. */
export function backTarget(state: NavState): string | null {
  if (!state.active) return null;
  const stack = state.stacks[state.active];
  return stack.length > 1 ? stack[stack.length - 2].url : null;
}

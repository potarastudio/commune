import { describe, expect, it } from "vitest";
import {
  applyNavigation,
  backTarget,
  defaultTabFor,
  emptyStacks,
  isPhoneUserAgent,
  isSurface,
  rootTabOf,
  synthesizeStack,
  type NavState,
} from "./mobile";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CommuneMobile/1.0.0";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 CommuneDesktop/1.0.2";

const start = (): NavState => ({ active: null, stacks: emptyStacks() });
const urls = (s: NavState) => (s.active ? s.stacks[s.active].map((e) => e.url) : []);

describe("isPhoneUserAgent", () => {
  it("gives phones and the phone app the mobile shell", () => {
    expect(isPhoneUserAgent(IPHONE)).toBe(true);
    expect(isPhoneUserAgent(APP)).toBe(true);
    expect(isPhoneUserAgent(ANDROID_PHONE)).toBe(true);
  });

  it("keeps tablets, desktops and the desktop app on the desktop shell", () => {
    expect(isPhoneUserAgent(ANDROID_TABLET)).toBe(false);
    expect(isPhoneUserAgent(IPAD)).toBe(false);
    expect(isPhoneUserAgent(MAC)).toBe(false);
    expect(isPhoneUserAgent(null)).toBe(false);
  });
});

describe("routes", () => {
  it("knows each tab's root, and that a settings section is inside You", () => {
    expect(rootTabOf("/")).toBe("channels");
    expect(rootTabOf("/dm")).toBe("dms");
    expect(rootTabOf("/settings")).toBe("you");
    expect(rootTabOf("/settings?section=notifications")).toBeNull();
    expect(rootTabOf("/activity?tab=mentions")).toBe("activity");
    expect(rootTabOf("/channel/abc")).toBeNull();
  });

  it("treats search, a new message and a huddle as surfaces, not stack entries", () => {
    expect(isSurface("/search?q=hero")).toBe(true);
    expect(isSurface("/dm/new")).toBe(true);
    expect(isSurface("/huddle/h1")).toBe(true);
    expect(isSurface("/dm/c1")).toBe(false);
  });

  it("files a cold URL under the tab it most likely came from", () => {
    expect(defaultTabFor("/dm/c1")).toBe("dms");
    expect(defaultTabFor("/channel/x?thread=m")).toBe("channels");
    expect(defaultTabFor("/channels")).toBe("you");
  });
});

describe("synthesizeStack", () => {
  it("puts a notification's thread on its channel, on Channels", () => {
    expect(synthesizeStack("/channel/x?thread=m")).toEqual({
      tab: "channels",
      stack: [
        { url: "/", viaPush: false },
        { url: "/channel/x", viaPush: false },
        { url: "/channel/x?thread=m", viaPush: false },
      ],
    });
  });

  it("puts a DM on the Messages list", () => {
    expect(synthesizeStack("/dm/c1").stack.map((e) => e.url)).toEqual(["/dm", "/dm/c1"]);
  });
});

describe("applyNavigation", () => {
  it("synthesises a stack on a cold start, so Back leads into the app", () => {
    const s = applyNavigation(start(), "/channel/design", null);
    expect(s.active).toBe("channels");
    expect(urls(s)).toEqual(["/", "/channel/design"]);
    expect(backTarget(s)).toBe("/");
  });

  it("pushes a tapped row onto the active tab and marks history as aligned", () => {
    let s = applyNavigation(start(), "/", null);
    s = applyNavigation(s, "/channel/design", null);
    expect(urls(s)).toEqual(["/", "/channel/design"]);
    expect(s.stacks.channels[1].viaPush).toBe(true);
  });

  it("keeps each tab's history when switching, and resumes it", () => {
    let s = applyNavigation(start(), "/", null);
    s = applyNavigation(s, "/channel/design", null);
    s = applyNavigation(s, "/dm", { kind: "tab", tab: "dms", url: "/dm" });
    expect(s.active).toBe("dms");
    expect(s.stacks.channels.map((e) => e.url)).toEqual(["/", "/channel/design"]);
    s = applyNavigation(s, "/channel/design", { kind: "tab", tab: "channels", url: "/channel/design" });
    expect(s.active).toBe("channels");
    expect(urls(s)).toEqual(["/", "/channel/design"]);
    // After the switch the browser's previous entry is the DMs screen, not "/".
    expect(s.stacks.channels[1].viaPush).toBe(false);
  });

  it("walks back only through the active tab", () => {
    let s = applyNavigation(start(), "/", null);
    s = applyNavigation(s, "/channel/design", null);
    s = applyNavigation(s, "/channel/design?thread=m1", null);
    expect(backTarget(s)).toBe("/channel/design");
    s = applyNavigation(s, "/channel/design", { kind: "back", url: "/channel/design" });
    expect(urls(s)).toEqual(["/", "/channel/design"]);
  });

  it("reads the browser's back button as a step back when the URL is in the stack", () => {
    let s = applyNavigation(start(), "/", null);
    s = applyNavigation(s, "/channel/design", null);
    s = applyNavigation(s, "/", null);
    expect(urls(s)).toEqual(["/"]);
  });

  it("replaces the top when the same conversation only changes its query", () => {
    let s = applyNavigation(start(), "/activity", null);
    s = applyNavigation(s, "/channel/design?message=m1", null);
    s = applyNavigation(s, "/channel/design?message=m2", null);
    expect(urls(s)).toEqual(["/activity", "/channel/design?message=m2"]);
  });

  it("jumps from Activity within Activity's own stack", () => {
    let s = applyNavigation(start(), "/activity", null);
    s = applyNavigation(s, "/channel/design?message=m1", null);
    expect(s.active).toBe("activity");
    expect(s.stacks.channels.map((e) => e.url)).toEqual(["/"]);
  });

  it("leaves the stacks alone for surfaces", () => {
    let s = applyNavigation(start(), "/", null);
    s = applyNavigation(s, "/channel/design", null);
    const before = s;
    s = applyNavigation(s, "/search?q=hero", null);
    expect(s).toEqual(before);
  });

  it("resets a tab when its tab is tapped again", () => {
    let s = applyNavigation(start(), "/", null);
    s = applyNavigation(s, "/channel/design", null);
    s = applyNavigation(s, "/", { kind: "reset", tab: "channels", url: "/" });
    expect(urls(s)).toEqual(["/"]);
    expect(backTarget(s)).toBeNull();
  });
});

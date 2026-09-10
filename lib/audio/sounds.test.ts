import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * jsdom has no Web Audio, so a small fake stands in. It records what was
 * scheduled, which is all the engine's contract is: given a name and a
 * running context, the right number of oscillators start.
 */
class FakeParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class FakeNode {
  connect(next: unknown) {
    return next;
  }
}
class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "running";
  currentTime = 0;
  destination = {};
  oscillators: FakeOscillator[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    return new FakeGain();
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
}

function stubLocalStorage() {
  // Node 22+ defines the global but leaves it undefined without --localstorage-file.
  if (globalThis.localStorage) return;
  const m = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

async function load(initial?: "suspended") {
  stubLocalStorage();
  vi.resetModules();
  FakeAudioContext.instances = [];
  (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  const sounds = await import("./sounds");
  const store = await import("@/lib/store/sounds");
  store.useSoundStore.setState({ sound: "ping" });
  // Touch the context so its state can be set before the first play.
  if (initial === "suspended") {
    await sounds.unlockAudio();
    FakeAudioContext.instances[0].state = "suspended";
  }
  return { ...sounds, store, ctx: () => FakeAudioContext.instances[0] };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 10_000 });
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
});

describe("message sound", () => {
  it("schedules the chosen tone", async () => {
    const s = await load();
    expect(s.playMessageSound()).toBe(true);
    // Ping is a fundamental plus one partial.
    expect(s.ctx().oscillators).toHaveLength(2);
    for (const o of s.ctx().oscillators) {
      expect(o.start).toHaveBeenCalledTimes(1);
      expect(o.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("is silent when the tone is None", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "none" });
    expect(s.playMessageSound()).toBe(false);
    expect(s.ctx()?.oscillators ?? []).toHaveLength(0);
  });

  it("turns a burst into one sound", async () => {
    const s = await load();
    expect(s.playMessageSound()).toBe(true);
    expect(s.playMessageSound()).toBe(false);
    vi.advanceTimersByTime(1_600);
    expect(s.playMessageSound()).toBe(true);
    expect(s.ctx().oscillators).toHaveLength(4);
  });

  it("stays quiet before the page has seen a gesture", async () => {
    const s = await load("suspended");
    expect(s.playMessageSound()).toBe(false);
    expect(s.ctx().oscillators).toHaveLength(0);
  });

  it("does nothing at all without Web Audio", async () => {
    vi.resetModules();
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
    const s = await import("./sounds");
    expect(s.playMessageSound()).toBe(false);
    expect(s.playHuddleSound("joined")).toBe(false);
  });
});

describe("preview", () => {
  it("unlocks a suspended context and then plays", async () => {
    const s = await load("suspended");
    expect(await s.previewSound("chime")).toBe(true);
    expect(s.ctx().resume).toHaveBeenCalled();
    expect(s.ctx().oscillators).toHaveLength(2);
  });

  it("ignores the throttle, since it is a deliberate click", async () => {
    const s = await load();
    expect(await s.previewSound("knock")).toBe(true);
    expect(await s.previewSound("knock")).toBe(true);
  });

  it("has nothing to play for None", async () => {
    const s = await load();
    expect(await s.previewSound("none")).toBe(false);
  });
});

describe("huddle sounds", () => {
  it("plays every event and each is a real pair of notes", async () => {
    const s = await load();
    for (const event of ["joined", "peerJoined", "peerLeft", "left"] as const) {
      expect(s.playHuddleSound(event)).toBe(true);
    }
    expect(s.ctx().oscillators).toHaveLength(8);
  });

  it("follow the same off switch as messages", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "none" });
    expect(s.playHuddleSound("peerJoined")).toBe(false);
  });
});

describe("preference store", () => {
  it("defaults to Ping, the design's default", async () => {
    await load();
    globalThis.localStorage.clear();
    vi.resetModules();
    const fresh = await import("@/lib/store/sounds");
    expect(fresh.useSoundStore.getState().sound).toBe("ping");
    expect(fresh.SOUND_NAMES).toContain("none");
  });
});

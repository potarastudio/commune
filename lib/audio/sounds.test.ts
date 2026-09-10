import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Node has no Web Audio, so a small fake stands in. It records what was
 * scheduled, which is all the engine's contract is: given a name and a
 * running context, the right nodes start.
 */
class FakeParam {
  value = 1;
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
class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  start = vi.fn();
  stop = vi.fn();
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
/** A decoded clip whose loudest sample is 0.5, so normalising to 0.3 means gain 0.6. */
const FAKE_BUFFER = {
  duration: 0.86,
  numberOfChannels: 2,
  getChannelData: () => new Float32Array([0, 0.5, -0.25, 0]),
};
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "running";
  currentTime = 0;
  destination = {};
  oscillators: FakeOscillator[] = [];
  sources: FakeBufferSource[] = [];
  gains: FakeGain[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  decodeAudioData = vi.fn(async () => FAKE_BUFFER);
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

const fetchOk = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }));
const fetch404 = vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));

async function load(initial?: "suspended") {
  stubLocalStorage();
  vi.resetModules();
  FakeAudioContext.instances = [];
  (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  (globalThis as { fetch: unknown }).fetch = fetchOk;
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

/** Let a fetch → decode → play chain settle under fake timers. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers({ now: 10_000 });
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
  fetchOk.mockClear();
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

describe("sampled sound", () => {
  it("fetches the file once, decodes it, and plays it through a buffer source", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "lawan" });
    expect(s.playMessageSound()).toBe(true);
    await settle();
    await settle();
    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(fetchOk).toHaveBeenCalledWith("/sounds/saya-akan-lawan.mp3");
    expect(s.ctx().decodeAudioData).toHaveBeenCalledTimes(1);
    expect(s.ctx().sources).toHaveLength(1);
    expect(s.ctx().sources[0].buffer).toBe(FAKE_BUFFER);
    expect(s.ctx().sources[0].start).toHaveBeenCalledTimes(1);
    expect(s.ctx().oscillators).toHaveLength(0);
  });

  it("normalises loudness: a 0.5 peak lands at the 0.3 target", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "lawan" });
    s.playMessageSound();
    await settle();
    await settle();
    expect(s.ctx().gains[0].gain.value).toBeCloseTo(0.6, 5);
  });

  it("reuses the decoded clip on the next play", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "lawan" });
    s.playMessageSound();
    await settle();
    await settle();
    vi.advanceTimersByTime(1_600);
    s.playMessageSound();
    await settle();
    await settle();
    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(s.ctx().sources).toHaveLength(2);
  });

  it("is throttled like a tone", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "lawan" });
    expect(s.playMessageSound()).toBe(true);
    expect(s.playMessageSound()).toBe(false);
  });

  it("skips quietly when the file cannot be fetched", async () => {
    const s = await load();
    (globalThis as { fetch: unknown }).fetch = fetch404;
    s.store.useSoundStore.setState({ sound: "lawan" });
    s.playMessageSound();
    await settle();
    await settle();
    expect(s.ctx().sources).toHaveLength(0);
  });

  it("is warmed up by the unlock gesture so the first notification is not late", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "lawan" });
    await s.unlockAudio();
    await settle();
    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(s.ctx().sources).toHaveLength(0); // loaded, not played
  });
});

describe("preview", () => {
  it("unlocks a suspended context and then plays", async () => {
    const s = await load("suspended");
    expect(await s.previewSound("chime")).toBe(true);
    expect(s.ctx().resume).toHaveBeenCalled();
    expect(s.ctx().oscillators).toHaveLength(2);
  });

  it("plays a sample too", async () => {
    const s = await load();
    expect(await s.previewSound("lawan")).toBe(true);
    expect(s.ctx().sources).toHaveLength(1);
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

  it("stay synthesised even when the message sound is a file", async () => {
    const s = await load();
    s.store.useSoundStore.setState({ sound: "lawan" });
    expect(s.playHuddleSound("joined")).toBe(true);
    expect(s.ctx().oscillators).toHaveLength(2);
    expect(s.ctx().sources).toHaveLength(0);
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
  });

  it("lists the file after the tones and keeps None last", async () => {
    const { SOUND_NAMES } = await import("@/lib/store/sounds");
    expect(SOUND_NAMES.at(-1)).toBe("none");
    expect(SOUND_NAMES.at(-2)).toBe("lawan");
  });
});

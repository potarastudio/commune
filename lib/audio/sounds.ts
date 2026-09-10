"use client";

import { useSoundStore, type SoundName } from "@/lib/store/sounds";

/**
 * Notification and huddle sounds.
 *
 * Two kinds. Tones are synthesised with the Web Audio API: a couple of
 * oscillator notes with a fast attack and an exponential decay, which is all a
 * short chime is. Samples are short audio files under public/sounds, fetched
 * and decoded once, then normalised so a loud recording lands at the same
 * level as the tones.
 *
 * Browsers refuse to make sound until the page has seen a user gesture, so an
 * AudioContext created early sits "suspended". installAudioUnlock resumes it on
 * the first pointer or key event; until then every play is a silent no-op.
 */
type Note = {
  freq: number;
  /** Seconds after the sound starts. */
  at: number;
  /** Seconds to decay to silence. */
  dur: number;
  /** Peak gain; 1 is far too loud, 0.15 is a soft chime. */
  gain?: number;
  type?: OscillatorType;
  /** Glide the pitch to this frequency over `dur`. */
  sweepTo?: number;
};

type SampleName = "lawan";
type ToneName = Exclude<SoundName, "none" | SampleName>;

/** The synthesised tones a person can choose in Settings. */
const TONES: Record<ToneName, Note[]> = {
  // A small bell: a fundamental with a quieter octave partial.
  ping: [
    { freq: 880, at: 0, dur: 0.45, gain: 0.16 },
    { freq: 1760, at: 0, dur: 0.3, gain: 0.05 },
  ],
  // Two rising notes, E5 to A5, on a softer waveform.
  chime: [
    { freq: 659.25, at: 0, dur: 0.16, gain: 0.14, type: "triangle" },
    { freq: 880, at: 0.11, dur: 0.3, gain: 0.14, type: "triangle" },
  ],
  // Two low taps, like knuckles on a desk.
  knock: [
    { freq: 190, at: 0, dur: 0.07, gain: 0.35 },
    { freq: 170, at: 0.13, dur: 0.07, gain: 0.3 },
  ],
  // One quick downward blip.
  pop: [{ freq: 520, at: 0, dur: 0.08, gain: 0.22, sweepTo: 260 }],
};

/** The recorded sounds, by URL. Keep them under a second or two. */
const SAMPLES: Record<SampleName, string> = {
  lawan: "/sounds/saya-akan-lawan.mp3",
};

/** Where a sample's loudest moment is placed, on the same scale as the tones' gains. */
const SAMPLE_TARGET_PEAK = 0.3;
/** Never amplify a quiet file more than this; it would raise the noise with it. */
const SAMPLE_MAX_BOOST = 2;
/** A file longer than this is cut here, so a stray long clip cannot take over. */
const SAMPLE_MAX_SECONDS = 3;

function isSample(name: SoundName): name is SampleName {
  return name in SAMPLES;
}

export type HuddleSoundEvent = "joined" | "peerJoined" | "peerLeft" | "left";

/** Huddle chimes are not chosen; they are silenced together with the tone above. */
const HUDDLE: Record<HuddleSoundEvent, Note[]> = {
  // You are in: C5 up to G5.
  joined: [
    { freq: 523.25, at: 0, dur: 0.14, gain: 0.12 },
    { freq: 783.99, at: 0.12, dur: 0.26, gain: 0.12 },
  ],
  // Someone arrived: a quicker, quieter rise.
  peerJoined: [
    { freq: 659.25, at: 0, dur: 0.1, gain: 0.09 },
    { freq: 987.77, at: 0.09, dur: 0.2, gain: 0.09 },
  ],
  // Someone left: the same pair, falling.
  peerLeft: [
    { freq: 987.77, at: 0, dur: 0.1, gain: 0.09 },
    { freq: 659.25, at: 0.09, dur: 0.2, gain: 0.09 },
  ],
  // You are out: G5 down to C5.
  left: [
    { freq: 783.99, at: 0, dur: 0.14, gain: 0.1 },
    { freq: 523.25, at: 0.12, dur: 0.26, gain: 0.1 },
  ],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** The context, only once it is allowed to make sound. */
function ready(): AudioContext | null {
  const c = context();
  return c && c.state === "running" ? c : null;
}

/** Resume the context. Only has an effect when called from a user gesture. */
export async function unlockAudio(): Promise<void> {
  const c = context();
  if (!c) return;
  if (c.state !== "running") await c.resume().catch(() => {});
  // If the chosen sound is a file, fetch it now so the first notification is not late.
  const chosen = useSoundStore.getState().sound;
  if (isSample(chosen) && c.state === "running") void loadSample(c, chosen);
}

/**
 * Listen for the first gesture on the page and unlock audio with it. Returns
 * the remover, for a useEffect cleanup.
 */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const remove = () => {
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  const once = () => {
    void unlockAudio();
    remove();
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
  return remove;
}

function schedule(c: AudioContext, notes: Note[]): void {
  const t0 = c.currentTime + 0.01;
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.sweepTo) osc.frequency.exponentialRampToValueAtTime(n.sweepTo, t0 + n.at + n.dur);
    const peak = n.gain ?? 0.15;
    gain.gain.setValueAtTime(0.0001, t0 + n.at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
}

type Loaded = { buffer: AudioBuffer; gain: number };
const loaded = new Map<SampleName, Promise<Loaded | null>>();

/**
 * Fetch and decode a sample once. The gain brings its loudest moment to
 * SAMPLE_TARGET_PEAK, so a file mastered hot does not blast next to a soft
 * ping. A failed fetch resolves to null and the sound is simply skipped.
 */
function loadSample(c: AudioContext, name: SampleName): Promise<Loaded | null> {
  let p = loaded.get(name);
  if (!p) {
    p = fetch(SAMPLES[name])
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`sound ${r.status}`))))
      .then((bytes) => c.decodeAudioData(bytes))
      .then((buffer) => {
        let peak = 0;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          for (const v of buffer.getChannelData(ch)) {
            const a = Math.abs(v);
            if (a > peak) peak = a;
          }
        }
        const gain = peak > 0 ? Math.min(SAMPLE_MAX_BOOST, SAMPLE_TARGET_PEAK / peak) : 1;
        return { buffer, gain };
      })
      .catch(() => null);
    loaded.set(name, p);
  }
  return p;
}

async function playSample(c: AudioContext, name: SampleName): Promise<boolean> {
  const sample = await loadSample(c, name);
  if (!sample) return false;
  const src = c.createBufferSource();
  src.buffer = sample.buffer;
  const gain = c.createGain();
  gain.gain.value = sample.gain;
  src.connect(gain).connect(c.destination);
  const t0 = c.currentTime;
  src.start(t0);
  src.stop(t0 + Math.min(sample.buffer.duration, SAMPLE_MAX_SECONDS));
  return true;
}

/** Start whichever kind of sound `name` is. Samples finish asynchronously. */
function play(c: AudioContext, name: Exclude<SoundName, "none">): Promise<boolean> {
  if (isSample(name)) return playSample(c, name);
  schedule(c, TONES[name]);
  return Promise.resolve(true);
}

/** A burst of messages is one sound, not ten. */
const MESSAGE_THROTTLE_MS = 1500;
let lastMessageAt = -Infinity;

/** The chosen sound, for a message that would notify you. False when silenced, throttled or locked. */
export function playMessageSound(): boolean {
  const name = useSoundStore.getState().sound;
  if (name === "none") return false;
  const now = Date.now();
  if (now - lastMessageAt < MESSAGE_THROTTLE_MS) return false;
  const c = ready();
  if (!c) return false;
  lastMessageAt = now;
  void play(c, name);
  return true;
}

/** Hear a sound on demand, from the picker. Unlocks first and skips the throttle. */
export async function previewSound(name: SoundName): Promise<boolean> {
  if (name === "none") return false;
  await unlockAudio();
  const c = ready();
  if (!c) return false;
  return play(c, name);
}

export function playHuddleSound(event: HuddleSoundEvent): boolean {
  if (useSoundStore.getState().sound === "none") return false;
  const c = ready();
  if (!c) return false;
  schedule(c, HUDDLE[event]);
  return true;
}

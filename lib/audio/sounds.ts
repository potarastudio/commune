"use client";

import { useSoundStore, type SoundName } from "@/lib/store/sounds";

/**
 * Notification and huddle tones, synthesised with the Web Audio API.
 *
 * No audio files: each sound is a couple of oscillator notes with a fast
 * attack and an exponential decay, which is all a short chime is. That keeps
 * them out of the bundle, instant to play, and free of anyone's licence.
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

/** The tones a person can choose in Settings. */
const TONES: Record<Exclude<SoundName, "none">, Note[]> = {
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

/** Resume the context. Only has an effect when called from a user gesture. */
export function unlockAudio(): Promise<void> {
  const c = context();
  if (!c || c.state === "running") return Promise.resolve();
  return c.resume().catch(() => {});
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

function schedule(notes: Note[]): boolean {
  const c = context();
  if (!c || c.state !== "running") return false;
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
  return true;
}

/** A burst of messages is one sound, not ten. */
const MESSAGE_THROTTLE_MS = 1500;
let lastMessageAt = -Infinity;

/** The chosen tone, for a message that would notify you. False when silenced, throttled or locked. */
export function playMessageSound(): boolean {
  const name = useSoundStore.getState().sound;
  if (name === "none") return false;
  const now = Date.now();
  if (now - lastMessageAt < MESSAGE_THROTTLE_MS) return false;
  if (!schedule(TONES[name])) return false;
  lastMessageAt = now;
  return true;
}

/** Hear a tone on demand, from the picker. Unlocks first and skips the throttle. */
export async function previewSound(name: SoundName): Promise<boolean> {
  if (name === "none") return false;
  await unlockAudio();
  return schedule(TONES[name]);
}

export function playHuddleSound(event: HuddleSoundEvent): boolean {
  if (useSoundStore.getState().sound === "none") return false;
  return schedule(HUDDLE[event]);
}

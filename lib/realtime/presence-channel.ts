"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * One Presence channel per topic, shared and reference-counted.
 *
 * supabase-js returns the same channel object for the same topic, and
 * removeChannel() is asynchronous. A React effect that re-runs (Strict Mode,
 * Fast Refresh, prop change) would otherwise attach to a channel the previous
 * run is still tearing down. Here the first acquirer creates and subscribes;
 * later ones share it; the last release removes it.
 */
type PresenceState = Record<string, Record<string, unknown>[]>;
type Listener = (state: PresenceState) => void;

type Entry = {
  topic: string;
  refs: number;
  listeners: Set<Listener>;
  channel: RealtimeChannel | null;
  ready: Promise<RealtimeChannel | null>;
  removing: Promise<void> | null;
};

const entries = new Map<string, Entry>();
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __presenceEntries: Map<string, Entry> }).__presenceEntries = entries;
}

async function create(topic: string, key: string): Promise<Entry> {
  const supabase = getSupabaseBrowserClient();
  const entry: Entry = { topic, refs: 0, listeners: new Set(), channel: null, ready: Promise.resolve(null), removing: null };
  entries.set(topic, entry);

  entry.ready = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
    if (entry.refs === 0) return null; // released before it ever subscribed
    const channel = supabase.channel(topic, { config: { presence: { key } } });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as PresenceState;
      for (const l of entry.listeners) l(state);
    });
    await new Promise<void>((resolve) => {
      channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`presence ${topic}: ${status}`, err?.message);
          resolve();
        }
      });
    });
    entry.channel = channel;
    return channel;
  })();
  return entry;
}

export type PresenceHandle = {
  /** Resolves once subscribed (or null if released first). */
  ready: Promise<RealtimeChannel | null>;
  track: (meta: Record<string, unknown>) => Promise<void>;
  untrack: () => Promise<void>;
  release: () => void;
};

export function acquirePresence(topic: string, key: string, onSync: Listener): PresenceHandle {
  let entry = entries.get(topic);
  let released = false;

  const start = async (): Promise<Entry> => {
    if (entry?.removing) await entry.removing; // wait for a previous teardown to finish
    entry = entries.get(topic) ?? (await create(topic, key));
    if (entry.removing) return start();
    return entry;
  };

  const attached = start().then((e) => {
    if (released) return e;
    e.refs += 1;
    e.listeners.add(onSync);
    return e;
  });

  const ready = attached.then((e) => e.ready);

  return {
    ready,
    track: async (meta) => {
      const ch = await ready;
      if (ch && !released) await ch.track(meta);
    },
    untrack: async () => {
      const ch = await ready;
      if (ch) await ch.untrack();
    },
    release: () => {
      released = true;
      void attached.then((e) => {
        if (!e.listeners.has(onSync)) return;
        e.listeners.delete(onSync);
        e.refs -= 1;
        if (e.refs > 0) return;
        e.removing = e.ready.then(async (ch) => {
          if (ch) await getSupabaseBrowserClient().removeChannel(ch);
          if (entries.get(topic) === e) entries.delete(topic);
        });
      });
    },
  };
}

"use client";

import { useConnectionState, useParticipants } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useEffect, useRef } from "react";
import { playHuddleSound } from "@/lib/audio/sounds";

/**
 * Renders nothing. A chime when you connect, and one for each person who
 * arrives or leaves while you are in the room. Your own leaving is played by
 * the provider's leave(), which is the one path every exit goes through.
 *
 * Lives inside LiveKitRoom so it can read the participant list. The roster is
 * snapshotted at the moment you connect, so people already in the huddle do
 * not each ring as if they had just walked in.
 */
export function HuddleSounds() {
  const state = useConnectionState();
  const participants = useParticipants();
  // null until connected: that first roster is the baseline, not a set of arrivals.
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (state !== ConnectionState.Connected || known.current !== null) return;
    playHuddleSound("joined");
    known.current = new Set(participants.map((p) => p.identity));
  }, [state, participants]);

  useEffect(() => {
    if (known.current === null) return;
    const now = new Set(participants.map((p) => p.identity));
    let arrived = false;
    let left = false;
    for (const id of now) if (!known.current.has(id)) arrived = true;
    for (const id of known.current) if (!now.has(id)) left = true;
    if (arrived) playHuddleSound("peerJoined");
    if (left) playHuddleSound("peerLeft");
    known.current = now;
  }, [participants]);

  return null;
}

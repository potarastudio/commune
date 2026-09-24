"use client";

import { useQuery } from "@tanstack/react-query";
import { Headphones, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enterHuddle } from "@/components/huddle/huddle-provider";
import { Skeleton } from "@/components/ui/skeleton";
import type { Container } from "@/lib/queries/messages";
import { useProfileMap } from "@/lib/queries/profiles";
import { useHuddleStore } from "@/lib/store/huddle";
import { useSessionStore } from "@/lib/store/session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMobileNav } from "./use-mobile-nav";
import { primaryButtonClass, RoundFace } from "./ui";

type Summary = {
  id: string;
  container: Container;
  label: string;
  href: string;
  startedAt: string;
  endedAt: string | null;
  starterId: string | null;
  /** Everyone who joined at some point, first to join first. */
  everyone: string[];
  /** Who is in it right now. */
  present: string[];
  messages: number;
};

async function fetchSummary(id: string, meId: string | null): Promise<Summary | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: h, error } = await supabase
    .from("huddles")
    .select("id, channel_id, conversation_id, started_at, ended_at, started_by, channel:channels(name), huddle_participants(user_id, joined_at, left_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!h) return null;
  const container: Container = h.channel_id ? { kind: "channel", id: h.channel_id } : { kind: "conversation", id: h.conversation_id! };
  const rows = [...(h.huddle_participants ?? [])].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const everyone = [...new Set(rows.map((r) => r.user_id))];
  const present = [...new Set(rows.filter((r) => !r.left_at).map((r) => r.user_id))];

  // What got posted in the conversation while the huddle ran.
  const column = container.kind === "channel" ? "channel_id" : "conversation_id";
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq(column, container.id)
    .gte("created_at", h.started_at)
    .lte("created_at", h.ended_at ?? new Date().toISOString())
    .is("deleted_at", null);

  let label = "the conversation";
  if (h.channel) label = `#${(h.channel as { name: string }).name}`;
  else if (meId) {
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id, profile:profiles(display_name)")
      .eq("conversation_id", container.id);
    const names = (members ?? [])
      .filter((m) => m.user_id !== meId)
      .map((m) => (m.profile as { display_name: string } | null)?.display_name.split(" ")[0])
      .filter(Boolean);
    if (names.length) label = names.join(", ");
  }

  return {
    id: h.id,
    container,
    label,
    href: container.kind === "channel" ? `/channel/${container.id}` : `/dm/${container.id}`,
    startedAt: h.started_at,
    endedAt: h.ended_at,
    starterId: h.started_by,
    everyone,
    present,
    messages: count ?? 0,
  };
}

function names(ids: string[], meId: string | null, nameOf: (id: string) => string): string {
  const list = [...ids.filter((id) => id !== meId).map(nameOf), ...(meId && ids.includes(meId) ? ["you"] : [])];
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function minutesBetween(a: string, b: string | null): number {
  return Math.max(1, Math.round(((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 60_000));
}

/**
 * The huddle screen when this phone is not connected to it (design: Mobile
 * Huddle → Invited, Ended). Running: who is already talking, and for how long
 * — the two things that decide whether you join — with a real "Not now".
 * Over: a receipt of how long, who was there and what got posted, then the
 * one thing you might want next.
 */
export function MobileHuddleSummary({ huddleId }: { huddleId: string }) {
  const router = useRouter();
  const nav = useMobileNav();
  const meId = useSessionStore((s) => s.meId);
  const profiles = useProfileMap();
  const connecting = useHuddleStore((s) => s.connecting);
  const [busy, setBusy] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ["huddle-summary", huddleId, meId],
    queryFn: () => fetchSummary(huddleId, meId),
    refetchInterval: (q) => (q.state.data && !q.state.data.endedAt ? 10_000 : false),
  });
  const nameOf = (id: string) => profiles.get(id)?.display_name.split(" ")[0] ?? "Someone";

  if (isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[12px] bg-bg-main px-[28px]" aria-busy="true" aria-label="Loading">
        <Skeleton className="size-[56px] rounded-[16px]" />
        <Skeleton className="h-[16px] w-[160px] rounded-[4px]" />
        <Skeleton className="h-[12px] w-[120px] rounded-[4px]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-bg-main px-[28px] text-center">
        <span className="grid size-[56px] place-items-center rounded-[16px] border border-border bg-bg-chip text-fg-600">
          <Headphones className="size-[25px]" aria-hidden="true" />
        </span>
        <h1 className="mt-[16px] text-[19px] font-semibold tracking-[-0.02em] text-ink">This huddle isn&rsquo;t available</h1>
        <p className="mt-[8px] max-w-[280px] text-[14px] leading-[1.6] text-fg-600">It may be in a conversation you are not part of.</p>
        <button type="button" onClick={nav.closeSurface} className="mt-[18px] flex h-[44px] items-center px-[14px] text-[14px] font-semibold text-fg-600">
          Go back
        </button>
      </div>
    );
  }

  const join = async (fresh: boolean) => {
    setBusy(true);
    const ok = await enterHuddle({ container: data.container, label: data.label, href: data.href, huddleId: fresh ? undefined : data.id });
    setBusy(false);
    const id = useHuddleStore.getState().session?.huddleId;
    if (ok && id && id !== huddleId) router.replace(`/huddle/${id}`);
  };

  if (!data.endedAt) {
    const talking = data.present.filter((id) => id !== meId);
    const faces = (talking.length ? talking : data.present).slice(0, 2);
    const minutes = minutesBetween(data.startedAt, null);
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-rail pb-[var(--safe-bottom)]">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[28px] py-[24px] text-center">
          <span className="flex shrink-0">
            {faces.map((id, i) => (
              <span key={id} className={i > 0 ? "-ml-[16px] rounded-full shadow-[0_0_0_3px_var(--rail)]" : "rounded-full"}>
                <RoundFace person={profiles.get(id) ?? null} size={66} />
              </span>
            ))}
          </span>
          <p className="mt-[20px] text-[13px] font-semibold tracking-[0.06em] text-primary uppercase">Huddle in {data.label}</p>
          <h1 className="mt-[9px] text-[24px] leading-[1.2] font-semibold tracking-[-0.03em] text-white [text-wrap:pretty]">
            {talking.length === 0 ? "Nobody is talking yet" : `${names(talking, null, nameOf)} ${talking.length === 1 ? "is" : "are"} talking`}
          </h1>
          <p className="mt-[9px] max-w-[280px] text-[14px] leading-[1.55] text-white/60">
            Started {minutes === 1 ? "a minute" : `${minutes} minutes`} ago.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-[10px] px-[20px] pb-[28px]">
          <button
            type="button"
            disabled={busy || connecting}
            onClick={() => void join(false)}
            className="flex h-[52px] items-center justify-center gap-[9px] rounded-[14px] border border-accent-border bg-primary text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-60"
          >
            <Headphones className="size-[19px]" aria-hidden="true" />
            {busy || connecting ? "Joining…" : "Join huddle"}
          </button>
          <button
            type="button"
            onClick={nav.closeSurface}
            className="flex h-[52px] items-center justify-center rounded-[14px] border border-white/14 bg-white/6 text-[16px] font-semibold text-white"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  const minutes = minutesBetween(data.startedAt, data.endedAt);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-bg-main px-[28px] py-[24px] pb-[calc(24px+var(--safe-bottom))] text-center">
      <span className="grid size-[56px] shrink-0 place-items-center rounded-[16px] border border-border bg-bg-chip text-fg-600">
        <Headphones className="size-[25px]" aria-hidden="true" />
      </span>
      <h1 className="mt-[16px] text-[19px] font-semibold tracking-[-0.02em] text-ink">Huddle ended</h1>
      <p className="mt-[8px] text-[14px] leading-[1.6] text-fg-600">
        {minutes === 1 ? "1 minute" : `${minutes} minutes`} · {data.everyone.length} {data.everyone.length === 1 ? "person" : "people"}
      </p>
      <div className="mt-[18px] w-full max-w-[290px] shrink-0 overflow-hidden rounded-[14px] border border-border bg-bg-card text-left">
        <p className="px-[14px] pt-[11px] pb-[9px] text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">Who was there</p>
        <div className="flex items-center gap-[11px] border-t border-border-subtle px-[14px] py-[11px]">
          <span className="flex shrink-0">
            {data.everyone.slice(0, 4).map((id, i) => (
              <span key={id} className={`block rounded-full shadow-[0_0_0_2px_var(--bg-card)] ${i > 0 ? "-ml-[9px]" : ""}`}>
                <RoundFace person={profiles.get(id) ?? null} size={30} />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1 text-[13px] text-body">{names(data.everyone, meId, nameOf)}</span>
        </div>
        <div className="flex items-center gap-[11px] border-t border-border-subtle px-[14px] py-[11px]">
          <MessageSquareText className="size-[16px] shrink-0 text-tertiary" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[13px] text-body">
            {data.messages === 0
              ? "Nothing was posted during the huddle"
              : `${data.messages} ${data.messages === 1 ? "message" : "messages"} posted during the huddle`}
          </span>
        </div>
      </div>
      <div className="mt-[16px] flex w-full max-w-[290px] shrink-0 flex-col gap-[9px]">
        <button type="button" disabled={busy || connecting} onClick={() => void join(true)} className={primaryButtonClass()}>
          <Headphones aria-hidden="true" />
          {busy || connecting ? "Starting…" : "Start another"}
        </button>
        <button
          type="button"
          onClick={() => nav.replaceSurface(data.href)}
          className="flex h-[44px] shrink-0 items-center justify-center rounded-[12px] text-[14px] font-semibold text-fg-600"
        >
          Back to {data.label}
        </button>
      </div>
    </div>
  );
}

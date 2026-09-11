"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AtSign, MessageSquareText } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { installAudioUnlock, playMessageSound } from "@/lib/audio/sounds";
import { desktopBridge } from "@/lib/desktop";
import { inDoNotDisturb } from "@/lib/push/dnd";
import { subscribeWithAuth } from "@/lib/realtime/messages";
import { fetchMessageById, type MessageRow } from "@/lib/queries/messages";
import { unreadKeys } from "@/lib/queries/unreads";
import type { UnreadMap } from "@/lib/utils/unreads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MentionRow = { message_id: string; user_id: string | null; kind: "user" | "channel" | "here" };

/**
 * In-app alerts (§5 Phase 2): a toast for a DM or a mention that lands while
 * you are looking at something else, and an unread count in the tab title.
 * Push handles the case where the window isn't in front (see public/sw.js).
 */
type Dnd = { dnd_start: string | null; dnd_end: string | null; timezone: string };

export function Notifier({ meId, mutedChannelIds, dnd }: { meId: string; mutedChannelIds: string[]; dnd: Dnd }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const muted = useRef(new Set(mutedChannelIds));
  muted.current = new Set(mutedChannelIds);
  const dndRef = useRef(dnd);
  dndRef.current = dnd;

  // Browsers only allow sound after a gesture; the first click or key unlocks it.
  useEffect(() => installAudioUnlock(), []);

  // In the desktop app a notification click asks the page to navigate, so the
  // realtime connection and any huddle survive it.
  useEffect(() => desktopBridge()?.onNavigate((url) => router.push(url)), [router]);
  const seen = useRef(new Set<string>());

  // Tab title: "(3) Commune" from the unread map already kept for the sidebar.
  // The design's "9+" cap belongs to the fixed-width rail and sidebar pills; the
  // title has no such constraint, so it keeps the real number up to 99.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    const apply = () => {
      const map = queryClient.getQueryData<UnreadMap>(unreadKeys.all) ?? {};
      const total = Object.values(map).reduce((n, v) => n + v.unread, 0);
      const clean = document.title.replace(/^\(\d+\+?\)\s*/, "");
      document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${clean}` : clean;
    };
    apply();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === "unreads") apply();
    });
    return () => {
      unsubscribe();
      document.title = base;
    };
  }, [queryClient]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const viewing = (row: Pick<MessageRow, "channel_id" | "conversation_id">) => {
      const p = pathRef.current;
      return (row.channel_id && p === `/channel/${row.channel_id}`) || (row.conversation_id && p === `/dm/${row.conversation_id}`);
    };

    const announce = async (messageId: string, reason: "dm" | "mention") => {
      if (seen.current.has(messageId)) return;
      seen.current.add(messageId);
      const m = await fetchMessageById(supabase, messageId);
      if (!m || m.author_id === meId || m.deleted_at) return;
      if (viewing(m) && document.visibilityState === "visible" && document.hasFocus()) return;
      if (m.channel_id && muted.current.has(m.channel_id)) return;

      const who = m.author?.display_name ?? "Someone";
      const where = m.channel_id ? " in a channel" : "";
      const href = m.channel_id
        ? `/channel/${m.channel_id}?${m.parent_id ? `thread=${m.parent_id}` : `message=${m.id}`}`
        : `/dm/${m.conversation_id}?${m.parent_id ? `thread=${m.parent_id}` : `message=${m.id}`}`;
      // The toast still shows during Do Not Disturb, as it always has; only the
      // sound respects the quiet hours, since a sound is the intrusion.
      const quiet = inDoNotDisturb(dndRef.current);
      if (!quiet) playMessageSound();
      // The desktop app has no push: it is told directly, and shows the
      // notification only while its window is not focused, like the service
      // worker defers to a focused tab. Same quiet hours as push.
      if (!quiet) void desktopBridge()?.notify({ title: reason === "dm" ? who : `${who} mentioned you${where}`, body: m.content_text.slice(0, 120) || "Sent a file", url: href, tag: m.conversation_id ?? m.channel_id ?? undefined });
      toast(reason === "dm" ? who : `${who} mentioned you${where}`, {
        // The icon fills the design's 26px leading tile (see components/ui/sonner.tsx).
        icon:
          reason === "dm" ? (
            <MessageSquareText className="size-[14px]" aria-hidden="true" />
          ) : (
            <AtSign className="size-[14px]" aria-hidden="true" />
          ),
        description: m.content_text.slice(0, 120) || "Sent a file",
        action: { label: "Open", onClick: () => router.push(href) },
        duration: 6000,
      });
    };

    const stop = subscribeWithAuth(
      supabase,
      "notifier",
      (channel) =>
        channel
          .on<MessageRow>("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
            const row = payload.new;
            if (row.conversation_id && row.author_id !== meId) void announce(row.id, "dm");
          })
          .on<MentionRow>("postgres_changes", { event: "INSERT", schema: "public", table: "mentions" }, (payload) => {
            const row = payload.new;
            if (row.kind === "user" ? row.user_id === meId : true) void announce(row.message_id, "mention");
          }),
      "notifier",
    );
    return stop;
  }, [meId, router]);

  return null;
}

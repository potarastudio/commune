"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
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
export function Notifier({ meId, mutedChannelIds }: { meId: string; mutedChannelIds: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const muted = useRef(new Set(mutedChannelIds));
  muted.current = new Set(mutedChannelIds);
  const seen = useRef(new Set<string>());

  // Tab title: "(3) Commune" from the unread map already kept for the sidebar.
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
      toast(reason === "dm" ? who : `${who} mentioned you${where}`, {
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

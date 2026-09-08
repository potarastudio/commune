import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Message, MessagePage, Thread } from "./messages";

/**
 * Cache patch helpers that work for both shapes we keep messages in:
 * the infinite container list and the { parent, replies } thread.
 */
type ListCache = InfiniteData<MessagePage, string | null>;

function isList(data: unknown): data is ListCache {
  return typeof data === "object" && data !== null && "pages" in data;
}
function isThread(data: unknown): data is Thread {
  return typeof data === "object" && data !== null && "replies" in data;
}

export function patchMessages(queryClient: QueryClient, key: readonly unknown[], fn: (ms: Message[]) => Message[]) {
  queryClient.setQueryData<unknown>(key, (old: unknown) => {
    if (isList(old)) return { ...old, pages: old.pages.map((p) => ({ ...p, messages: fn(p.messages) })) };
    if (isThread(old)) {
      const [parent] = fn([old.parent]);
      return { parent: parent ?? old.parent, replies: fn(old.replies) };
    }
    return old;
  });
}

/** Append a confirmed message, replacing an optimistic twin and ignoring duplicates. */
export function appendMessage(queryClient: QueryClient, key: readonly unknown[], full: Message) {
  const append = (ms: Message[]) => {
    if (ms.some((m) => m.id === full.id)) return ms;
    const withoutTwin = ms.filter(
      (m) => !(m.pending && m.author_id === full.author_id && m.content_text === full.content_text),
    );
    return [...withoutTwin, full];
  };
  queryClient.setQueryData<unknown>(key, (old: unknown) => {
    if (isList(old)) return { ...old, pages: old.pages.map((p, i) => (i === 0 ? { ...p, messages: append(p.messages) } : p)) };
    if (isThread(old)) return { ...old, replies: append(old.replies) };
    return old;
  });
}

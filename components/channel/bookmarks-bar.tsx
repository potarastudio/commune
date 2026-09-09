"use client";

import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addBookmarkAction, removeBookmarkAction, updateBookmarkAction } from "@/lib/actions/bookmarks";
import { useBookmarks, type Bookmark as BookmarkRow } from "@/lib/queries/use-bookmarks";

/** The design's field: 38px, hairline input border, 3px accent halo on focus. */
const field =
  "field-focus h-[38px] w-full rounded-lg border border-border-input bg-bg-card px-[11px] text-[14px] text-body shadow-xs outline-none placeholder:text-muted-foreground";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function BookmarkForm({ channelId, existing, onDone }: { channelId: string; existing?: BookmarkRow; onDone: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = existing
        ? await updateBookmarkAction({ id: existing.id, title, url, emoji: emoji || null })
        : await addBookmarkAction({ channelId, title, url, emoji: emoji || null });
      if (!result.ok) {
        setError({ field: result.field, message: result.error });
        return;
      }
      toast.success(existing ? "Bookmark saved" : "Bookmark added");
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="w-[300px] p-4">
      <h3 className="text-[15.5px] font-semibold tracking-[-0.015em] text-ink">{existing ? "Edit bookmark" : "Add a bookmark"}</h3>
      <p className="mt-[3px] text-[12.5px] leading-[1.5] text-fg-600">A link the channel keeps coming back to.</p>

      <div className="mt-3.5 flex gap-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔗" aria-label="Emoji (optional)" maxLength={16} className={`${field} w-12 shrink-0 px-0 text-center`} />
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" aria-label="Bookmark name" maxLength={80} className={field} />
      </div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" inputMode="url" className={`${field} mt-2`} />
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] leading-[1.45] text-danger">
          {error.message}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] leading-[1.45] text-muted-foreground">Short names keep the bar readable.</p>
      )}

      <div className="mt-3.5 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || !title.trim() || !url.trim()}>
          {pending ? "Saving…" : existing ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function BookmarkChip({ bookmark, canEdit }: { bookmark: BookmarkRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const remove = () =>
    startTransition(async () => {
      const result = await removeBookmarkAction({ id: bookmark.id });
      if (!result.ok) toast.error(result.error);
      else toast.success("Bookmark removed");
    });

  return (
    <span className="group/bm flex shrink-0 items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[26px] max-w-[220px] shrink-0 items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-chip px-2 text-[12.5px] font-medium text-fg-400 transition-colors hover:border-border-chip-hover hover:bg-bg-avatar"
          >
            {bookmark.emoji ? (
              <span role="img" aria-hidden="true" className="text-[12px] leading-none">
                {bookmark.emoji}
              </span>
            ) : (
              <Link2 className="size-[13px] shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="truncate">{bookmark.title}</span>
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom">{host(bookmark.url)}</TooltipContent>
      </Tooltip>
      {canEdit && (
        <span className="flex w-0 items-center overflow-hidden transition-[width] group-focus-within/bm:w-[52px] group-hover/bm:w-[52px]">
          <Popover open={editing} onOpenChange={setEditing}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Edit bookmark ${bookmark.title}`}
                className="ml-1 grid size-[22px] shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-bg-subtle hover:text-ink"
              >
                <Pencil className="size-[11px]" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <BookmarkForm channelId={bookmark.channel_id} existing={bookmark} onDone={() => setEditing(false)} />
            </PopoverContent>
          </Popover>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            aria-label={`Remove bookmark ${bookmark.title}`}
            className="ml-0.5 grid size-[22px] shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-danger-surface hover:text-danger"
          >
            <Trash2 className="size-[11px]" aria-hidden="true" />
          </button>
        </span>
      )}
    </span>
  );
}

/** Links pinned under the channel header (§5 Phase 3). Members add, edit and remove; everyone can open them. */
export function BookmarksBar({ channelId, initialBookmarks, canEdit }: { channelId: string; initialBookmarks: BookmarkRow[]; canEdit: boolean }) {
  const { data } = useBookmarks(channelId, initialBookmarks);
  const [adding, setAdding] = useState(false);
  const bookmarks = data ?? [];
  if (bookmarks.length === 0 && !canEdit) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-bg-main px-5" aria-label="Bookmarks">
      {bookmarks.map((b) => (
        <BookmarkChip key={b.id} bookmark={b} canEdit={canEdit} />
      ))}
      {canEdit && (
        <Popover open={adding} onOpenChange={setAdding}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-[26px] shrink-0 items-center gap-1 rounded-sm px-[7px] text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-bg-chip hover:text-fg-400"
            >
              <Plus className="size-[13px]" aria-hidden="true" />
              {bookmarks.length === 0 ? "Add a bookmark" : "Add"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <BookmarkForm channelId={channelId} onDone={() => setAdding(false)} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

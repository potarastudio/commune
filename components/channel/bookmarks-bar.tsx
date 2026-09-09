"use client";

import { Bookmark, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addBookmarkAction, removeBookmarkAction, updateBookmarkAction } from "@/lib/actions/bookmarks";
import { useBookmarks, type Bookmark as BookmarkRow } from "@/lib/queries/use-bookmarks";

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

  const input = "h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";
  return (
    <form onSubmit={submit} className="w-72 space-y-2.5 p-3">
      <h3 className="text-[13px] font-semibold">{existing ? "Edit bookmark" : "Add a bookmark"}</h3>
      <div className="flex gap-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔗" aria-label="Emoji (optional)" maxLength={16} className={`${input} w-12 shrink-0 text-center`} />
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name" aria-label="Bookmark name" maxLength={80} className={input} />
      </div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" inputMode="url" className={input} />
      {error && (
        <p role="alert" className="text-[12px] text-destructive">
          {error.message}
        </p>
      )}
      <div className="flex justify-end gap-1.5 pt-1">
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
    <span className="group/bm flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 max-w-56 items-center gap-1.5 rounded-md px-2 text-[13px] text-foreground/85 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {bookmark.emoji ? (
              <span role="img" aria-hidden="true" className="text-[13px] leading-none">
                {bookmark.emoji}
              </span>
            ) : (
              <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="truncate">{bookmark.title}</span>
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom">{host(bookmark.url)}</TooltipContent>
      </Tooltip>
      {canEdit && (
        <span className="flex w-0 items-center overflow-hidden transition-[width] group-focus-within/bm:w-12 group-hover/bm:w-12">
          <Popover open={editing} onOpenChange={setEditing}>
            <PopoverTrigger asChild>
              <button type="button" aria-label={`Edit bookmark ${bookmark.title}`} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                <Pencil className="size-3" aria-hidden="true" />
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
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Trash2 className="size-3" aria-hidden="true" />
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
    <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-3" aria-label="Bookmarks">
      <Bookmark className="mr-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {bookmarks.map((b) => (
        <BookmarkChip key={b.id} bookmark={b} canEdit={canEdit} />
      ))}
      {canEdit && (
        <Popover open={adding} onOpenChange={setAdding}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${bookmarks.length === 0 ? "" : "opacity-70 hover:opacity-100"}`}
            >
              <Plus className="size-3.5" aria-hidden="true" />
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

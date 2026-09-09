"use client";

import { Check, Pencil, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { addChannelMembersAction } from "@/lib/actions/channels";
import type { ChannelRow } from "@/lib/queries/channel";
import type { Profile } from "@/lib/queries/profile";
import { useProfiles } from "@/lib/queries/profiles";

export type Member = Pick<Profile, "id" | "display_name" | "handle" | "avatar_url" | "title">;

/** 11.5/700 caps overline — the design's label for every panel field. */
const overline = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground";
const field =
  "field-focus w-full rounded-lg border border-border-input bg-bg-card px-[11px] text-[14px] text-body shadow-xs outline-none placeholder:text-muted-foreground";

/** Label + value that turns into an input on the pencil, saves on Enter. */
export function InlineField({
  label,
  value,
  placeholder,
  maxLength,
  multiline,
  canEdit,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  canEdit: boolean;
  onSave: (next: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      if (await onSave(draft)) setEditing(false);
    });

  return (
    <div className="border-b border-border-subtle py-[11px]">
      <div className="flex min-h-[18px] items-center justify-between gap-2">
        <span className={overline}>{label}</span>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            aria-label={`Edit ${label.toLowerCase()}`}
            className="grid size-[22px] shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-bg-subtle hover:text-ink"
          >
            <Pencil className="size-[13px]" aria-hidden="true" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          {multiline ? (
            <textarea
              autoFocus
              value={draft}
              maxLength={maxLength}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              className={`${field} resize-none py-2 leading-[1.5]`}
            />
          ) : (
            <input
              autoFocus
              value={draft}
              maxLength={maxLength}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className={`${field} h-[38px]`}
            />
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className={`mt-1 text-[13.5px] leading-[1.5] ${value ? "text-body" : "text-muted-foreground"}`}>{value || placeholder}</p>
      )}
    </div>
  );
}

/** Multi-select of people not yet in the channel. */
export function AddPeople({ channel, members, onDone }: { channel: ChannelRow; members: Member[]; onDone?: () => void }) {
  const router = useRouter();
  const { data: people } = useProfiles();
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const candidates = (people ?? []).filter(
    (p) => !memberIds.has(p.id) && (query === "" || p.display_name.toLowerCase().includes(query.toLowerCase()) || p.handle.includes(query.toLowerCase())),
  );

  const add = () =>
    startTransition(async () => {
      const result = await addChannelMembersAction({ channelId: channel.id, userIds: picked });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(picked.length === 1 ? "Added 1 person" : `Added ${picked.length} people`);
      setPicked([]);
      router.refresh();
      onDone?.();
    });

  return (
    <div>
      <div className="field-focus flex h-[34px] items-center gap-2 rounded-md border border-border-strong bg-bg-chip px-2.5">
        <Search className="size-[14px] shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a person"
          aria-label="Search people to add"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-body outline-none placeholder:text-muted-foreground"
        />
      </div>

      <ul className="mt-2 max-h-52 overflow-y-auto rounded-md border border-border-subtle" role="listbox" aria-multiselectable="true" aria-label="People to add">
        {candidates.length === 0 && <li className="px-3 py-3.5 text-[12.5px] text-muted-foreground">Everyone is already here.</li>}
        {candidates.map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => setPicked((c) => (on ? c.filter((x) => x !== p.id) : [...c, p.id]))}
                className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-bg-hover"
              >
                <Avatar size="sm">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback>{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{p.display_name}</span>
                  <span className="block truncate text-[12px] text-fg-600">@{p.handle}</span>
                </span>
                <span
                  className={`grid size-[18px] shrink-0 place-items-center rounded-full border ${on ? "border-accent-border bg-primary text-primary-foreground" : "border-border-input"}`}
                  aria-hidden="true"
                >
                  {on && <Check className="size-[11px]" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button type="button" size="sm" className="mt-2.5 w-full" disabled={picked.length === 0 || pending} onClick={add}>
        {pending ? "Adding…" : picked.length ? `Add ${picked.length} to #${channel.name}` : "Add people"}
      </Button>
    </div>
  );
}

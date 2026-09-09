"use client";

import { Check, Pencil } from "lucide-react";
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
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            aria-label={`Edit ${label.toLowerCase()}`}
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1 space-y-2">
          {multiline ? (
            <textarea
              autoFocus
              value={draft}
              maxLength={maxLength}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
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
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          )}
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className={`mt-0.5 text-[13px] leading-relaxed ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</p>
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
    <div className="space-y-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people"
        aria-label="Search people to add"
        className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
      />
      <ul className="max-h-48 overflow-y-auto rounded-md border border-border" role="listbox" aria-multiselectable="true" aria-label="People to add">
        {candidates.length === 0 && <li className="px-2.5 py-3 text-[12px] text-muted-foreground">Everyone is already here.</li>}
        {candidates.map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => setPicked((c) => (on ? c.filter((x) => x !== p.id) : [...c, p.id]))}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                <Avatar className="size-5 rounded">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="rounded bg-accent text-[9px] font-semibold text-accent-foreground">{p.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">{p.display_name}</span>
                <span className={`grid size-4 place-items-center rounded-full border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} aria-hidden="true">
                  {on && <Check className="size-3" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button type="button" size="sm" className="w-full" disabled={picked.length === 0 || pending} onClick={add}>
        {pending ? "Adding…" : picked.length ? `Add ${picked.length} to #${channel.name}` : "Add people"}
      </Button>
    </div>
  );
}

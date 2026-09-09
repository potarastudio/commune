"use client";

import { Check, ChevronDown, Hash, Lock, Pencil, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addChannelMembersAction, updateChannelAction } from "@/lib/actions/channels";
import type { ChannelRow } from "@/lib/queries/channel";
import type { Profile } from "@/lib/queries/profile";
import { useProfiles } from "@/lib/queries/profiles";
import type { NotificationLevel } from "@/lib/queries/channels";
import { ArchiveChannelControl } from "./archive-channel";
import { JoinLeaveButton } from "./join-leave-button";
import { NotificationLevelControl } from "./notification-level";

type Member = Pick<Profile, "id" | "display_name" | "handle" | "avatar_url" | "title">;

function InlineField({
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
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <p className={`mt-0.5 text-[13px] ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</p>
      )}
    </div>
  );
}

function AddPeople({ channel, members }: { channel: ChannelRow; members: Member[] }) {
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
    });

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people"
        aria-label="Search people to add"
        className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
      />
      <ul className="max-h-40 overflow-y-auto rounded-md border border-border" role="listbox" aria-multiselectable="true" aria-label="People to add">
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
                  <AvatarFallback className="rounded bg-accent text-[9px] font-semibold text-accent-foreground">
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
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

/** Channel header popover: topic/description (inline edit), members, add people, leave. */
export function ChannelDetails({
  channel,
  members,
  isMember,
  isAdmin,
  notificationLevel,
}: {
  channel: ChannelRow;
  members: Member[];
  isMember: boolean;
  isAdmin: boolean;
  notificationLevel: NotificationLevel | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"about" | "add">("about");
  const canEdit = isMember || isAdmin;
  const Icon = channel.is_private ? Lock : Hash;

  const save = (field: "topic" | "description") => async (next: string) => {
    const result = await updateChannelAction({ channelId: channel.id, [field]: next });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  return (
    <Popover onOpenChange={(o) => !o && setTab("about")}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[15px] font-semibold tracking-tight hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`${channel.name} details`}
        >
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {channel.name}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0">
        <div className="flex items-center gap-1 border-b border-border p-1.5">
          {(["about", "add"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`rounded-md px-2.5 py-1 text-[13px] ${tab === t ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "about" ? "About" : "Add people"}
            </button>
          ))}
          <span className="ml-auto pr-1 text-[12px] text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        {tab === "about" ? (
          <div className="space-y-4 p-4">
            <InlineField label="Topic" value={channel.topic} placeholder="Add a topic" maxLength={250} canEdit={canEdit} onSave={save("topic")} />
            <InlineField
              label="Description"
              value={channel.description}
              placeholder="Add a description"
              maxLength={1000}
              multiline
              canEdit={canEdit}
              onSave={save("description")}
            />
            {isMember && notificationLevel && (
              <div>
                <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Notifications</span>
                <div className="mt-1.5">
                  <NotificationLevelControl channelId={channel.id} level={notificationLevel} />
                </div>
              </div>
            )}
            <div>
              <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Members</span>
              <ul className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-[13px]">
                    <Avatar className="size-6 rounded">
                      <AvatarImage src={m.avatar_url ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="rounded bg-accent text-[10px] font-semibold text-accent-foreground">
                        {m.display_name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">
                      {m.display_name}
                      {m.title && <span className="ml-1.5 text-muted-foreground">{m.title}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setTab("add")}
                disabled={!isMember && !isAdmin}
                className="flex items-center gap-1.5 text-[13px] font-medium text-link disabled:opacity-50"
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Add people
              </button>
              <JoinLeaveButton channelId={channel.id} channelName={channel.name} joined={isMember} afterLeaveHref={channel.is_private ? "/" : undefined} />
            </div>
            {isAdmin && !channel.is_archived && (
              <div className="border-t border-border pt-3">
                <ArchiveChannelControl channelId={channel.id} channelName={channel.name} />
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <AddPeople channel={channel} members={members} />
            <button type="button" onClick={() => setTab("about")} className="mt-3 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              <X className="size-3.5" aria-hidden="true" /> Back to details
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

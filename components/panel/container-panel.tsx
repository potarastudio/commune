"use client";

import { UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArchiveChannelControl } from "@/components/channel/archive-channel";
import { AddPeople, InlineField, type Member } from "@/components/channel/channel-fields";
import { JoinLeaveButton } from "@/components/channel/join-leave-button";
import { NotificationLevelControl } from "@/components/channel/notification-level";
import { PinsList } from "@/components/pins/pins-list";
import { OnlineDot } from "@/components/presence/online-dot";
import { ProfileCard } from "@/components/profile/profile-card";
import { UserStatus } from "@/components/profile/user-status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updateChannelAction } from "@/lib/actions/channels";
import type { ChannelRow } from "@/lib/queries/channel";
import type { NotificationLevel } from "@/lib/queries/channels";
import type { Container, Message, MessageAuthor } from "@/lib/queries/messages";
import { useThreadNav, type PanelTab } from "@/lib/utils/use-thread-nav";
import { FilesList } from "./files-list";

/**
 * Right-hand details panel (§6: 400px) for a channel or DM: About (channels
 * only), Members, Files, Pins. Opened via ?panel=details&tab=… or ?panel=pins.
 */
export function ContainerPanel({
  container,
  containerLabel,
  channel,
  members,
  isMember,
  isAdmin,
  notificationLevel,
  me,
  initialPins,
}: {
  container: Container;
  containerLabel: string;
  channel?: ChannelRow;
  members: Member[];
  isMember: boolean;
  isAdmin: boolean;
  notificationLevel: NotificationLevel | null;
  me: MessageAuthor;
  initialPins: Message[];
}) {
  const router = useRouter();
  const { panelTab, showPanel, closePanel } = useThreadNav();
  const tabs: PanelTab[] = channel ? ["about", "members", "files", "pins"] : ["members", "files", "pins"];
  const tab: PanelTab = panelTab && tabs.includes(panelTab) ? panelTab : tabs[0];
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest(".tiptap, input, textarea"))) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanel]);

  const saveField = (field: "topic" | "description") => async (next: string) => {
    if (!channel) return false;
    const result = await updateChannelAction({ channelId: channel.id, [field]: next });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const labels: Record<PanelTab, string> = { about: "About", members: channel ? "Members" : "People", files: "Files", pins: "Pins" };

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-border bg-background" aria-label={`${containerLabel} details`}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{containerLabel}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close details"
              className="ml-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close (Esc)</TooltipContent>
        </Tooltip>
      </header>

      <div role="tablist" aria-label="Details sections" className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => showPanel("details", t)}
            className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] focus-visible:outline-2 focus-visible:outline-ring ${
              tab === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {tab === "about" && channel && (
          <div className="space-y-5 p-4">
            <InlineField label="Topic" value={channel.topic} placeholder="Add a topic" maxLength={250} canEdit={isMember || isAdmin} onSave={saveField("topic")} />
            <InlineField label="Description" value={channel.description} placeholder="Add a description" maxLength={1000} multiline canEdit={isMember || isAdmin} onSave={saveField("description")} />
            {isMember && notificationLevel && (
              <div>
                <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Notifications</span>
                <div className="mt-1.5">
                  <NotificationLevelControl channelId={channel.id} level={notificationLevel} />
                </div>
              </div>
            )}
            <div>
              <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Created</span>
              <p className="mt-0.5 text-[13px]">{new Date(channel.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-[13px] text-muted-foreground">{channel.is_private ? "Private channel" : "Public channel"}</span>
              <JoinLeaveButton channelId={channel.id} channelName={channel.name} joined={isMember} afterLeaveHref={channel.is_private ? "/" : undefined} />
            </div>
            {isAdmin && !channel.is_archived && (
              <div className="border-t border-border pt-4">
                <ArchiveChannelControl channelId={channel.id} channelName={channel.name} />
              </div>
            )}
          </div>
        )}

        {tab === "members" && (
          <div className="p-3">
            {channel && (isMember || isAdmin) && (
              <div className="mb-2">
                {adding ? (
                  <div className="rounded-lg border border-border p-3">
                    <AddPeople channel={channel} members={members} onDone={() => setAdding(false)} />
                    <button type="button" onClick={() => setAdding(false)} className="mt-2 text-[12px] text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-link hover:bg-message-hover focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="grid size-8 place-items-center rounded-md bg-accent text-accent-foreground">
                      <UserPlus className="size-4" aria-hidden="true" />
                    </span>
                    Add people
                  </button>
                )}
              </div>
            )}
            <ul>
              {members.map((m) => (
                <li key={m.id}>
                  <ProfileCard userId={m.id} side="bottom" align="start">
                    <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-message-hover focus-visible:outline-2 focus-visible:outline-ring">
                      <Avatar className="size-8 rounded-md">
                        <AvatarImage src={m.avatar_url ?? undefined} alt="" className="object-cover" />
                        <AvatarFallback className="rounded-md bg-accent text-[12px] font-semibold text-accent-foreground">{m.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[13px] font-medium">
                          <span className="truncate">{m.display_name}</span>
                          <UserStatus userId={m.id} />
                          <OnlineDot userId={m.id} />
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          @{m.handle}
                          {m.title ? ` · ${m.title}` : ""}
                        </span>
                      </span>
                    </button>
                  </ProfileCard>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "files" && <FilesList container={container} containerLabel={containerLabel} />}

        {tab === "pins" && <PinsList container={container} containerLabel={containerLabel} me={me} isAdmin={isAdmin} initialPins={initialPins} />}
      </div>
    </aside>
  );
}

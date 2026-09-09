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
import { AvatarPresence } from "@/components/presence/online-dot";
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

const overline = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground";

/**
 * Right-hand details panel for a channel or DM: About (channels only),
 * Members, Files, Pins. 340px per the design's column scale, opened via
 * ?panel=details&tab=… or ?panel=pins.
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
  const memberWord = members.length === 1 ? "member" : "members";
  const subtitle = channel
    ? `${channel.is_private ? "Private" : "Public"} · ${members.length} ${memberWord}`
    : `${members.length} ${members.length === 1 ? "person" : "people"}`;
  const canAdd = Boolean(channel) && (isMember || isAdmin);
  const canArchive = isAdmin && Boolean(channel) && !channel?.is_archived;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-bg-main" aria-label={`${containerLabel} details`}>
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border pl-4 pr-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">{containerLabel}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{subtitle}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close details"
              className="grid size-[30px] shrink-0 place-items-center rounded-md text-fg-600 hover:bg-bg-subtle hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close (Esc)</TooltipContent>
        </Tooltip>
      </header>

      <div role="tablist" aria-label="Details sections" className="flex shrink-0 items-center gap-0.5 border-b border-border px-3 py-2">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => showPanel("details", t)}
            className={`flex h-7 items-center rounded-[7px] border px-2.5 text-[12.5px] font-semibold transition-colors ${
              tab === t ? "border-border-strong bg-bg-card text-ink shadow-xs" : "border-transparent text-fg-600 hover:text-ink"
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col" role="tabpanel">
        {tab === "about" && channel && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1">
            <InlineField label="Topic" value={channel.topic} placeholder="Add a topic" maxLength={250} canEdit={isMember || isAdmin} onSave={saveField("topic")} />
            <InlineField label="Description" value={channel.description} placeholder="Add a description" maxLength={1000} multiline canEdit={isMember || isAdmin} onSave={saveField("description")} />
            {isMember && notificationLevel && (
              <div className="border-b border-border-subtle py-[11px]">
                <span className={overline}>Notifications</span>
                <div className="mt-2">
                  <NotificationLevelControl channelId={channel.id} level={notificationLevel} />
                </div>
              </div>
            )}
            <div className="border-b border-border-subtle py-[11px]">
              <span className={overline}>Created</span>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-body">
                {new Date(channel.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {/* Visibility already reads in the header subtitle, so the body ends
                the design's way: archive above, then Leave — bottom, red, and
                never adjacent to a save action. */}
            {canArchive && (
              <div className="pt-3.5">
                <ArchiveChannelControl channelId={channel.id} channelName={channel.name} />
              </div>
            )}
            <div className={canArchive ? "pt-2.5" : "pt-3.5"}>
              <JoinLeaveButton
                channelId={channel.id}
                channelName={channel.name}
                joined={isMember}
                size="default"
                className="w-full"
                afterLeaveHref={channel.is_private ? "/" : undefined}
              />
            </div>
          </div>
        )}

        {tab === "members" && (
          <>
            <ul className="flex-1 overflow-y-auto pb-2">
              {members.map((m) => (
                <li key={m.id}>
                  <ProfileCard userId={m.id} side="bottom" align="start">
                    <button type="button" className="flex w-full items-center gap-[11px] px-4 py-[9px] text-left hover:bg-bg-hover">
                      <span className="relative block size-8 shrink-0">
                        <Avatar>
                          <AvatarImage src={m.avatar_url ?? undefined} alt="" className="object-cover" />
                          <AvatarFallback>{m.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <AvatarPresence userId={m.id} ring="border-bg-main" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold text-ink">{m.display_name}</span>
                          <UserStatus userId={m.id} />
                        </span>
                        <span className="block truncate text-[12px] text-fg-600">
                          @{m.handle}
                          {m.id === me.id ? " · You" : m.title ? ` · ${m.title}` : ""}
                        </span>
                      </span>
                    </button>
                  </ProfileCard>
                </li>
              ))}
            </ul>
            {canAdd && channel && (
              <div className="shrink-0 border-t border-border-subtle p-4">
                {adding ? (
                  <div>
                    <AddPeople channel={channel} members={members} onDone={() => setAdding(false)} />
                    <button type="button" onClick={() => setAdding(false)} className="mt-2 text-[12.5px] font-medium text-fg-600 hover:text-ink">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex h-[34px] items-center gap-[7px] rounded-md border border-border-strong bg-bg-card px-[13px] text-[13px] font-semibold text-ink shadow-xs transition-colors hover:border-border-hover hover:bg-bg-card-hover"
                  >
                    <UserPlus className="size-[14px]" aria-hidden="true" />
                    Add people
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === "files" && (
          <div className="flex-1 overflow-y-auto">
            <FilesList container={container} containerLabel={containerLabel} />
          </div>
        )}

        {tab === "pins" && (
          <div className="flex-1 overflow-y-auto">
            <PinsList container={container} containerLabel={containerLabel} me={me} isAdmin={isAdmin} initialPins={initialPins} />
          </div>
        )}
      </div>
    </aside>
  );
}

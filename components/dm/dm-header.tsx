import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlineDot } from "@/components/presence/online-dot";
import { UserStatus } from "@/components/profile/user-status";
import { DetailsButton, MembersButton } from "@/components/channel/panel-buttons";
import { conversationLabel, type ConversationMember } from "@/lib/queries/conversations";

export function DmHeader({
  members,
  meId,
  huddle,
  pins,
}: {
  members: ConversationMember[];
  meId: string;
  huddle?: React.ReactNode;
  pins?: React.ReactNode;
}) {
  const others = members.filter((m) => m.id !== meId);
  const label = conversationLabel(members, meId);
  const single = others.length === 1 ? others[0] : null;
  const shown = others.length === 0 ? members : others;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
      <div className="flex -space-x-2">
        {shown.slice(0, 3).map((m) => (
          <Avatar key={m.id} className="size-6 rounded-md ring-2 ring-background">
            <AvatarImage src={m.avatar_url ?? undefined} alt="" className="object-cover" />
            <AvatarFallback className="rounded-md bg-accent text-[11px] font-semibold text-accent-foreground">
              {m.display_name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <h1 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        {label}
        {single && <OnlineDot userId={single.id} />}
      </h1>
      {single && (
        <>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <p className="flex min-w-0 items-center gap-2 truncate text-[13px] text-muted-foreground">
            <span className="truncate">
              @{single.handle}
              {single.title ? ` · ${single.title}` : ""}
            </span>
            <UserStatus userId={single.id} withText className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[12px] text-foreground" />
          </p>
        </>
      )}
      <span className="ml-auto flex items-center gap-2">
        {huddle}
        {pins}
        {others.length > 1 ? <MembersButton count={members.length} /> : <DetailsButton />}
      </span>
    </header>
  );
}

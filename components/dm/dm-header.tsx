import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { conversationLabel, type ConversationMember } from "@/lib/queries/conversations";

export function DmHeader({ members, meId }: { members: ConversationMember[]; meId: string }) {
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
      <h1 className="text-[15px] font-semibold tracking-tight">{label}</h1>
      {single && (
        <>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <p className="min-w-0 truncate text-[13px] text-muted-foreground">
            @{single.handle}
            {single.title ? ` · ${single.title}` : ""}
          </p>
        </>
      )}
      {others.length > 1 && (
        <span className="ml-auto rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground">
          {members.length} people
        </span>
      )}
    </header>
  );
}

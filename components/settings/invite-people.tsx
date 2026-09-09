"use client";

import { Check, Copy, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteAction, revokeInviteAction, type InviteResult } from "@/lib/actions/invites";
import type { InviteRow } from "@/lib/queries/invites";
import { MemberRole } from "./member-role";

/** Admin-only: allowlist an address and send the invitation email. */
export function InvitePeople({ invites, meId }: { invites: InviteRow[]; meId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [last, setLast] = useState<InviteResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await inviteAction({ email });
      setLast(result);
      if (result.ok) {
        setEmail("");
        toast.success(result.emailed ? `Invitation sent to ${result.email}` : `${result.email} can sign in now`);
        router.refresh();
      }
    });
  };

  const revoke = (address: string) =>
    startTransition(async () => {
      const result = await revokeInviteAction({ email: address });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${address}`);
      router.refresh();
    });

  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const waiting = invites.filter((i) => !i.profile);
  const joined = invites.filter((i) => i.profile);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="flex gap-2" noValidate>
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            aria-label="Email address to invite"
            autoComplete="off"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending || !email.trim()} className="gap-1.5">
          <Send className="size-4" aria-hidden="true" />
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </form>

      {last && !last.ok && (
        <p role="alert" className="text-[13px] text-destructive">
          {last.error}
        </p>
      )}
      {last && last.ok && !last.emailed && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-[13px]">
          <p>
            <strong>{last.email}</strong> is on the list and can sign in with Google. {last.note ?? ""} Share this link with them:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[12px]">{last.link}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => void copy(last.link)} className="gap-1.5">
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Invited, not yet signed in</h3>
        {waiting.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Nobody is waiting. Everyone you invited has joined.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {waiting.map((i) => (
              <li key={i.email} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{i.email}</span>
                <span className="hidden text-[12px] text-muted-foreground sm:block">
                  {i.invited_by ? `by ${i.invited_by.display_name}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => revoke(i.email)}
                  disabled={pending}
                  aria-label={`Remove ${i.email}`}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Members</h3>
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {joined.map((i) => (
            <li key={i.email} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <Avatar className="size-6 rounded">
                <AvatarImage src={i.profile?.avatar_url ?? undefined} alt="" className="object-cover" />
                <AvatarFallback className="rounded bg-accent text-[10px] font-semibold text-accent-foreground">
                  {(i.profile?.display_name ?? i.email).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">
                {i.profile?.display_name}
                <span className="ml-1.5 text-muted-foreground">@{i.profile?.handle}</span>
              </span>
              {i.profile && <MemberRole userId={i.profile.id} role={i.profile.role} name={i.profile.display_name} isMe={i.profile.id === meId} />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

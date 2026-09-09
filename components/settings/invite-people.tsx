"use client";

import { Check, Copy, Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteAction, revokeInviteAction, type InviteResult } from "@/lib/actions/invites";
import type { InviteRow } from "@/lib/queries/invites";
import { MemberRole } from "./member-role";

const OVERLINE = "text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground";
const CARD = "overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs";
const ROW = "flex flex-wrap items-center gap-3 px-4 py-3";

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
    <div>
      <form onSubmit={submit} className="flex flex-wrap gap-[7px]" noValidate>
        <div className="relative min-w-[220px] flex-1">
          <Mail className="pointer-events-none absolute inset-y-0 left-[10px] my-auto size-[15px] text-muted-foreground" aria-hidden="true" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            aria-label="Email address to invite"
            autoComplete="off"
            className="pl-[32px]"
          />
        </div>
        <Button type="submit" disabled={pending || !email.trim()}>
          <Send aria-hidden="true" />
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </form>

      {last && !last.ok && (
        <p role="alert" className="mt-3 rounded-[10px] border border-danger bg-danger-surface px-[12px] py-[9px] text-[13px] text-danger">
          {last.error}
        </p>
      )}
      {last && last.ok && !last.emailed && (
        <div className="mt-3 rounded-[12px] border border-accent-surface-border bg-accent-surface px-4 py-3 text-[13px] leading-[1.5] text-accent-foreground">
          <p>
            <strong className="font-semibold">{last.email}</strong> is on the list and can sign in with Google. {last.note ?? ""} Share this
            link with them:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm border border-accent-surface-border bg-bg-card px-[6px] py-[3px] font-mono text-[12px] text-body">
              {last.link}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => void copy(last.link)}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <h3 className={`mt-[22px] ${OVERLINE}`}>In the studio</h3>
      <div className={`mt-[9px] ${CARD}`}>
        <ul className="divide-y divide-border-subtle">
          {joined.map((i) => (
            <li key={i.email} className={ROW}>
              <Avatar>
                <AvatarImage src={i.profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-accent-surface text-[12px] font-semibold text-accent-foreground">
                  {(i.profile?.display_name ?? i.email).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-[150px] flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {i.profile?.display_name}
                  {i.profile?.id === meId && <span className="font-normal text-fg-600"> (you)</span>}
                </span>
                <span className="mt-px block truncate text-[12px] text-muted-foreground">
                  @{i.profile?.handle} · {i.email}
                </span>
              </span>
              {i.profile && (
                <MemberRole userId={i.profile.id} role={i.profile.role} name={i.profile.display_name} isMe={i.profile.id === meId} />
              )}
            </li>
          ))}
        </ul>
      </div>

      <h3 className={`mt-[22px] ${OVERLINE}`}>Invited, not yet signed in</h3>
      {waiting.length === 0 ? (
        <p className="mt-[9px] rounded-[12px] border border-dashed border-border-input px-4 py-5 text-center text-[13px] text-fg-600">
          Nobody is waiting. Everyone you invited has joined.
        </p>
      ) : (
        <div className={`mt-[9px] ${CARD}`}>
          <ul className="divide-y divide-border-subtle">
            {waiting.map((i) => (
              <li key={i.email} className={ROW}>
                <span
                  aria-hidden="true"
                  className="grid size-[34px] shrink-0 place-items-center rounded-full border border-dashed border-border-input bg-bg-chip text-[12px] font-semibold text-muted-foreground"
                >
                  {i.email.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-[150px] flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{i.email}</span>
                  <span className="mt-px block truncate text-[12px] text-muted-foreground">
                    {i.invited_by ? `Invited by ${i.invited_by.display_name}` : "Invited"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => revoke(i.email)}
                  disabled={pending}
                  aria-label={`Revoke the invitation for ${i.email}`}
                  className="flex h-[32px] shrink-0 items-center rounded-[8px] px-[9px] text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-danger-surface hover:text-danger disabled:pointer-events-none disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

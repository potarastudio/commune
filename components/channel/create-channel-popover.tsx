"use client";

import { Hash, Lock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createChannelAction } from "@/lib/actions/channels";
import { channelNameProblem, normaliseChannelName } from "@/lib/utils/channel-name";

const label = "mb-1.5 block text-[12.5px] font-semibold text-fg-400";
const field =
  "field-focus flex h-[38px] items-center gap-0.5 rounded-lg border border-border-input bg-bg-card px-[11px] shadow-xs";
const input = "min-w-0 flex-1 bg-transparent text-[14px] text-body outline-none placeholder:text-muted-foreground";

/** One of the two "who can join" cards: a real radio, drawn the design's way. */
function VisibilityCard({
  checked,
  onSelect,
  icon: Icon,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: typeof Hash;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${
        checked ? "border-accent-border bg-accent-surface" : "border-border-strong bg-bg-card hover:border-border-hover"
      }`}
    >
      <input type="radio" name="channel-visibility" className="sr-only" checked={checked} onChange={onSelect} />
      <span
        aria-hidden="true"
        className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] bg-bg-card ${checked ? "border-primary" : "border-border-input"}`}
      >
        <span className={`block size-2.5 rounded-full ${checked ? "bg-primary" : "bg-transparent"}`} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
          <Icon className={`size-[13px] ${checked ? "text-accent-foreground" : "text-fg-600"}`} aria-hidden="true" />
          {title}
        </span>
        <span className={`mt-0.5 block text-[12.5px] leading-[1.45] ${checked ? "text-accent-foreground" : "text-fg-600"}`}>{hint}</span>
      </span>
    </label>
  );
}

/** Create a channel from a popover (§6: no modal where a popover will do). */
export function CreateChannelPopover({ children, align = "end" }: { children?: React.ReactNode; align?: "start" | "end" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const problem = channelNameProblem(normaliseChannelName(name));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(async () => {
      const result = await createChannelAction({ name, description, isPrivate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
      setError(null);
      toast.success(`#${result.data.name} created`);
      router.push(`/channel/${result.data.id}`);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            Create channel
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[380px] overflow-hidden p-0">
        <form onSubmit={submit} noValidate className="flex max-h-[min(600px,calc(100vh-96px))] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[18px] pt-4">
            <h3 className="text-[15.5px] font-semibold tracking-[-0.015em] text-ink">Create a channel</h3>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-fg-600">Channels keep one subject in one place.</p>

            <div className="pt-3.5">
              <label htmlFor="channel-name" className={label}>
                Name
              </label>
              <div className={field}>
                <span className="shrink-0 text-[14px] font-medium text-muted-foreground" aria-hidden="true">
                  #
                </span>
                <input
                  id="channel-name"
                  autoFocus
                  value={name}
                  maxLength={40}
                  placeholder="bluebird-launch"
                  className={`${input} ml-1`}
                  onChange={(e) => {
                    // While typing keep trailing dashes; the server normalises fully.
                    setName(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40));
                    setError(null);
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby="channel-name-hint"
                />
                <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground" aria-hidden="true">
                  {40 - name.length}
                </span>
              </div>
              <p id="channel-name-hint" className={`mt-1.5 text-[12px] leading-[1.45] ${error ? "text-danger" : "text-muted-foreground"}`}>
                {error ?? "Lower case, no spaces. Short beats descriptive."}
              </p>
            </div>

            <div className="pt-3.5">
              <label htmlFor="channel-description" className={label}>
                Description <span className="font-normal text-muted-foreground">— optional</span>
              </label>
              <div className={field}>
                <input
                  id="channel-description"
                  value={description}
                  maxLength={1000}
                  placeholder="What belongs in here?"
                  className={input}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-3.5">
              <span className={label} id="channel-visibility-label">
                Who can join
              </span>
              <div className="flex flex-col gap-[7px]" role="radiogroup" aria-labelledby="channel-visibility-label">
                <VisibilityCard
                  checked={!isPrivate}
                  onSelect={() => setIsPrivate(false)}
                  icon={Hash}
                  title="Public"
                  hint="Anyone at Potara Studio can find it and join."
                />
                <VisibilityCard
                  checked={isPrivate}
                  onSelect={() => setIsPrivate(true)}
                  icon={Lock}
                  title="Private"
                  hint="Invite only, and out of search for everyone else. This can’t be changed later."
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 border-t border-border-subtle bg-bg-col px-4 py-3">
            <p className="min-w-0 flex-1 text-[12px] text-muted-foreground">You can change this later.</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || Boolean(problem)}>
              {pending ? "Creating…" : "Create channel"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

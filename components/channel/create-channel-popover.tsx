"use client";

import { Hash, Lock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createChannelAction } from "@/lib/actions/channels";
import { channelNameProblem, normaliseChannelName } from "@/lib/utils/channel-name";

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
      <PopoverContent align={align} className="w-80 p-4">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <h3 className="text-[14px] font-semibold">Create a channel</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Channels are where the studio talks about a topic, project or client.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                {isPrivate ? <Lock className="size-3.5" aria-hidden="true" /> : <Hash className="size-3.5" aria-hidden="true" />}
              </span>
              <Input
                id="channel-name"
                autoFocus
                value={name}
                maxLength={40}
                placeholder="e.g. bluebird-website"
                className="pl-8 font-mono"
                onChange={(e) => {
                  // While typing keep trailing dashes; the server normalises fully.
                  setName(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40));
                  setError(null);
                }}
                aria-invalid={Boolean(error)}
                aria-describedby="channel-name-hint"
              />
            </div>
            <p id="channel-name-hint" className={`text-[12px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
              {error ?? "Lowercase letters, numbers and dashes."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="channel-description"
              value={description}
              maxLength={1000}
              placeholder="What is this channel for?"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-[13px]">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 size-3.5 accent-[var(--primary)]" />
            <span>
              <span className="block font-medium">Make private</span>
              <span className="block text-[12px] text-muted-foreground">
                Only people you add can find it or read it. This can&apos;t be changed later.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || Boolean(problem)}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

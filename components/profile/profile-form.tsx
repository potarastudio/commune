"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfileAction, type ProfileFormResult } from "@/lib/actions/profile";
import type { Profile } from "@/lib/queries/profile";
import { useHandleAvailable } from "@/lib/queries/profiles";
import { DISPLAY_NAME_MAX, HANDLE_MAX, TITLE_MAX, handleProblem, normaliseHandle } from "@/lib/utils/profile";
import { AvatarPicker } from "./avatar-picker";

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

export function ProfileForm({ profile, mode }: { profile: Profile; mode: "welcome" | "settings" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [title, setTitle] = useState(profile.title ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<ProfileFormResult | null>(null);

  // First run: default to the browser's timezone when it is one we list.
  useEffect(() => {
    if (mode !== "welcome") return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONES.includes(tz)) setTimezone(tz);
  }, [mode]);

  const handleIssue = handleProblem(handle);
  const availability = useHandleAvailable(handleIssue ? "" : handle, profile.id);
  const handleTaken = availability.data === false;
  const handleOk = !handleIssue && availability.data === true;
  const unchangedHandle = handle === profile.handle;

  const canSubmit =
    displayName.trim().length > 0 && !handleIssue && (unchangedHandle || handleOk) && !pending && !availability.isFetching;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveProfileAction({
        display_name: displayName,
        handle,
        title,
        timezone,
        avatar_url: avatarUrl,
      });
      if (!result.ok) {
        setError(result);
        return;
      }
      if (mode === "welcome") {
        router.replace("/");
      } else {
        toast.success("Profile saved");
        router.refresh();
      }
    });
  };

  const fieldError = (field: "display_name" | "handle" | "title") =>
    error && !error.ok && error.field === field ? error.error : null;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <AvatarPicker
        userId={profile.id}
        value={avatarUrl}
        fallback={(displayName.trim() || profile.email).slice(0, 1).toUpperCase()}
        onChange={setAvatarUrl}
      />

      <div className="space-y-1.5">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          value={displayName}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          onChange={(e) => setDisplayName(e.target.value)}
          aria-invalid={Boolean(fieldError("display_name"))}
          aria-describedby="display_name_hint"
        />
        <p id="display_name_hint" className="text-[12px] text-muted-foreground">
          {fieldError("display_name") ?? "How your name appears on messages."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="handle">Handle</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">@</span>
          <Input
            id="handle"
            value={handle}
            maxLength={HANDLE_MAX}
            autoComplete="username"
            spellCheck={false}
            className="pl-7 pr-9 font-mono"
            onChange={(e) => setHandle(normaliseHandle(e.target.value))}
            aria-invalid={Boolean(handleIssue || handleTaken || fieldError("handle"))}
            aria-describedby="handle_hint"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center" aria-hidden="true">
            {!handleIssue && !unchangedHandle && handleOk && <Check className="size-4 text-online" />}
            {(handleTaken || handleIssue) && handle.length > 0 && <X className="size-4 text-destructive" />}
          </span>
        </div>
        <p id="handle_hint" className="text-[12px] text-muted-foreground" aria-live="polite">
          {fieldError("handle") ??
            (handle.length === 0
              ? "People will mention you as @handle."
              : handleIssue
                ? handleIssue
                : handleTaken
                  ? "Someone already has that handle."
                  : unchangedHandle
                    ? "People mention you as @" + handle + "."
                    : handleOk
                      ? "@" + handle + " is free."
                      : "Checking…")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">
          Job title <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="title"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="Product Designer"
          autoComplete="organization-title"
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(fieldError("title"))}
        />
        {fieldError("title") && <p className="text-[12px] text-destructive">{fieldError("title")}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-[14px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        >
          {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="text-[12px] text-muted-foreground">Message times are shown in your timezone.</p>
      </div>

      {error && !error.ok && !error.field && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]">
          {error.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={!canSubmit} className="h-10 px-5">
          {pending ? "Saving…" : mode === "welcome" ? "Start using Commune" : "Save changes"}
        </Button>
        {mode === "settings" && (
          <span className="text-[12px] text-muted-foreground">Signed in as {profile.email}</span>
        )}
      </div>
    </form>
  );
}

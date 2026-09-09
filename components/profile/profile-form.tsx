"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { saveProfileAction, type ProfileFormResult } from "@/lib/actions/profile";
import type { Profile } from "@/lib/queries/profile";
import { useHandleAvailable } from "@/lib/queries/profiles";
import { DISPLAY_NAME_MAX, HANDLE_MAX, TITLE_MAX, handleProblem, normaliseHandle } from "@/lib/utils/profile";
import { describeExpiry, isStatusActive } from "@/lib/utils/status";
import { AvatarPicker } from "./avatar-picker";
import { StatusEditor } from "./status-editor";

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

/**
 * A settings row: label + note on the left, one 260px control on the right.
 * The note is the field's description — it carries the id the input points at
 * with `aria-describedby` — and it is a PERMANENT live region. Adding
 * `aria-live` only when the tone turns danger/ok would create the region in the
 * same render that changes its text, which most screen readers do not announce.
 */
function Row({
  htmlFor,
  noteId,
  label,
  note,
  tone = "muted",
  children,
}: {
  htmlFor: string;
  noteId?: string;
  label: React.ReactNode;
  note: React.ReactNode;
  tone?: "muted" | "danger" | "ok";
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-[14px]">
      <span className="min-w-[180px] flex-1">
        <Label htmlFor={htmlFor} className="text-[13.5px] text-ink">
          {label}
        </Label>
        <span
          id={noteId}
          className={`mt-[3px] block text-[12.5px] leading-[1.5] ${
            tone === "danger" ? "text-danger" : tone === "ok" ? "text-presence" : "text-fg-600"
          }`}
          aria-live="polite"
        >
          {note}
        </span>
      </span>
      <div className="w-[260px] max-w-full shrink-0">{children}</div>
    </div>
  );
}

export function ProfileForm({ profile, mode }: { profile: Profile; mode: "welcome" | "settings" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [title, setTitle] = useState(profile.title ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<ProfileFormResult | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusActive = isStatusActive(profile);
  // describeExpiry gives "Until 17:30" / "Until Sun 09:00"; the design's row reads "Clears automatically at …".
  const statusUntil = describeExpiry(profile.status_expires_at, profile.timezone)?.replace(/^Until /, "") ?? null;

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

  const dirty =
    displayName !== profile.display_name ||
    handle !== profile.handle ||
    title !== (profile.title ?? "") ||
    timezone !== profile.timezone ||
    avatarUrl !== profile.avatar_url;

  const discard = () => {
    setDisplayName(profile.display_name);
    setHandle(profile.handle);
    setTitle(profile.title ?? "");
    setTimezone(profile.timezone);
    setAvatarUrl(profile.avatar_url);
    setError(null);
  };

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

  const handleNote =
    fieldError("handle") ??
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
              : "Checking…");
  const handleTone: "muted" | "danger" | "ok" =
    fieldError("handle") || handleTaken || (handleIssue && handle.length > 0) ? "danger" : handleOk && !unchangedHandle ? "ok" : "muted";

  const fallback = (displayName.trim() || profile.email).slice(0, 1).toUpperCase();

  const timezoneSelect = (
    <div className="field-focus relative flex h-[34px] items-center rounded-[8px] border border-border-input bg-bg-card shadow-xs">
      <select
        id="timezone"
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        className="h-full w-full appearance-none rounded-[8px] bg-transparent pl-[10px] pr-[28px] text-[13px] font-medium text-ink outline-none"
      >
        {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
          <option key={tz} value={tz}>
            {tz.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-[10px] size-[13px] text-muted-foreground" aria-hidden="true" />
    </div>
  );

  const handleField = (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-[10px] z-10 flex items-center text-[13.5px] text-muted-foreground">@</span>
      <Input
        id="handle"
        value={handle}
        maxLength={HANDLE_MAX}
        autoComplete="username"
        spellCheck={false}
        className={`pl-[22px] pr-[30px] font-mono ${mode === "welcome" ? "h-[40px] rounded-[10px] pl-[23px] text-[14px]" : ""}`}
        onChange={(e) => setHandle(normaliseHandle(e.target.value))}
        aria-invalid={Boolean(handleIssue || handleTaken || fieldError("handle"))}
        aria-describedby="handle_hint"
      />
      <span className="pointer-events-none absolute inset-y-0 right-[10px] flex items-center" aria-hidden="true">
        {!handleIssue && !unchangedHandle && handleOk && <Check className="size-[15px] text-presence" />}
        {(handleTaken || handleIssue) && handle.length > 0 && <X className="size-[15px] text-danger" />}
      </span>
    </div>
  );

  // ── First run: one stacked column, 40px fields, per the New Member Setup design.
  if (mode === "welcome") {
    return (
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="rounded-[12px] border border-border bg-bg-card p-4 shadow-xs">
          <AvatarPicker
            userId={profile.id}
            value={avatarUrl}
            fallback={fallback}
            onChange={setAvatarUrl}
            heading="Profile photo"
            headingKind="label"
            hint="Square works best. PNG or JPG, under 5 MB."
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="display_name" className="mb-[6px]">
              Display name
            </Label>
            <Input
              id="display_name"
              value={displayName}
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="name"
              className="h-[40px] rounded-[10px] px-[12px] text-[14px]"
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={Boolean(fieldError("display_name"))}
              aria-describedby="display_name_hint"
            />
            <p
              id="display_name_hint"
              className={`mt-[6px] text-[12px] ${fieldError("display_name") ? "text-danger" : "text-muted-foreground"}`}
            >
              {fieldError("display_name") ?? "How your name appears on messages."}
            </p>
          </div>

          <div>
            <Label htmlFor="handle" className="mb-[6px]">
              Handle
            </Label>
            {handleField}
            <p
              id="handle_hint"
              className={`mt-[6px] text-[12px] ${
                handleTone === "danger" ? "text-danger" : handleTone === "ok" ? "text-presence" : "text-muted-foreground"
              }`}
              aria-live="polite"
            >
              {handleNote}
            </p>
          </div>

          <div>
            <Label htmlFor="title" className="mb-[6px]">
              Job title <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="title"
              value={title}
              maxLength={TITLE_MAX}
              placeholder="Product Designer"
              autoComplete="organization-title"
              className="h-[40px] rounded-[10px] px-[12px] text-[14px]"
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(fieldError("title"))}
            />
            <p className={`mt-[6px] text-[12px] ${fieldError("title") ? "text-danger" : "text-muted-foreground"}`}>
              {fieldError("title") ?? "Shown on your profile card."}
            </p>
          </div>

          <div>
            <Label htmlFor="timezone" className="mb-[6px]">
              Timezone
            </Label>
            <div className="field-focus relative flex h-[40px] items-center rounded-[10px] border border-border-input bg-bg-card shadow-xs">
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-full w-full appearance-none rounded-[10px] bg-transparent pl-[12px] pr-[32px] text-[14px] text-body outline-none"
              >
                {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-[12px] size-[15px] text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-[6px] text-[12px] text-muted-foreground">Message times are shown in your timezone.</p>
          </div>
        </div>

        {error && !error.ok && !error.field && (
          <p role="alert" className="rounded-[10px] border border-danger bg-danger-surface px-[12px] py-[9px] text-[13px] text-danger">
            {error.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {pending ? "Saving…" : "Start using Commune"}
        </Button>
      </form>
    );
  }

  // ── Settings: the photo card, the details card with its save bar, then Status.
  return (
    <>
      <form onSubmit={submit} noValidate>
        <div className="rounded-[12px] border border-border bg-bg-card p-4 shadow-xs">
          <AvatarPicker
            userId={profile.id}
            value={avatarUrl}
            fallback={fallback}
            onChange={setAvatarUrl}
            showPresence
            heading={displayName.trim() || profile.display_name}
            meta={
              <>
                @{handle}
                {title.trim() ? ` · ${title.trim()}` : ""}
                {profile.role === "admin" ? " · Admin" : ""}
              </>
            }
          />
        </div>

        <div className="mt-3 overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs">
          <div className="divide-y divide-border-subtle">
            <Row
              htmlFor="display_name"
              noteId="display_name_hint"
              label="Display name"
              note={fieldError("display_name") ?? "What people see in messages and mentions."}
              tone={fieldError("display_name") ? "danger" : "muted"}
            >
              <Input
                id="display_name"
                value={displayName}
                maxLength={DISPLAY_NAME_MAX}
                autoComplete="name"
                onChange={(e) => setDisplayName(e.target.value)}
                aria-invalid={Boolean(fieldError("display_name"))}
                aria-describedby="display_name_hint"
              />
            </Row>

            <Row htmlFor="handle" noteId="handle_hint" label="Handle" note={handleNote} tone={handleTone}>
              {handleField}
            </Row>

            <Row
              htmlFor="title"
              label={
                <>
                  Job title <span className="font-normal text-fg-600">(optional)</span>
                </>
              }
              note={fieldError("title") ?? "Shown on your profile card."}
              tone={fieldError("title") ? "danger" : "muted"}
            >
              <Input
                id="title"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="Product Designer"
                autoComplete="organization-title"
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={Boolean(fieldError("title"))}
              />
            </Row>

            <Row htmlFor="timezone" label="Time zone" note="Message times are shown in your timezone.">
              {timezoneSelect}
            </Row>

            {error && !error.ok && !error.field && (
              <p role="alert" className="bg-danger-surface px-4 py-[10px] text-[13px] leading-[1.5] text-danger">
                {error.error}
              </p>
            )}
          </div>

          {/* The design's action bar: a --bg-col band under a full-width hairline. */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-bg-col px-4 py-3">
            <p className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
              {dirty ? "Unsaved changes." : `Signed in as ${profile.email}.`}
            </p>
            <Button type="button" variant="ghost" onClick={discard} disabled={!dirty || pending}>
              Discard
            </Button>
            <Button type="submit" disabled={!canSubmit || !dirty}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>

      <h3 className="mt-[22px] text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Status</h3>
      <div className="mt-[9px] overflow-hidden rounded-[12px] border border-border bg-bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-4 px-4 py-[14px]">
          <span className="min-w-[180px] flex-1">
            <span className="block text-[13.5px] font-semibold text-ink">Current status</span>
            <span className="mt-[3px] block text-[12.5px] leading-[1.5] text-fg-600">
              {statusActive ? (statusUntil ? `Clears automatically at ${statusUntil}.` : "Stays until you clear it.") : "Shown next to your name across Commune."}
            </span>
          </span>
          {/* Portalled, so the editor's own <form> never nests inside this one. */}
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-[34px] w-[260px] max-w-full shrink-0 items-center gap-2 rounded-[8px] border border-border-input bg-bg-card px-[10px] text-[13px] text-body shadow-xs transition-colors hover:border-border-hover hover:bg-bg-card-hover"
              >
                {statusActive && profile.status_emoji && (
                  <span role="img" aria-hidden="true" className="shrink-0 text-[14px] leading-none">
                    {profile.status_emoji}
                  </span>
                )}
                <span className={`min-w-0 flex-1 truncate text-left ${statusActive ? "" : "text-muted-foreground"}`}>
                  {statusActive ? (profile.status_text ?? "Status set") : "Set a status"}
                </span>
                <ChevronDown className="size-[13px] shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              {statusOpen && <StatusEditor profile={profile} onDone={() => setStatusOpen(false)} />}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
}

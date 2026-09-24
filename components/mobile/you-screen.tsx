"use client";

import { Bell, ChevronRight, Hash, Lock, LogOut, SmilePlus, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { StatusEditor } from "@/components/profile/status-editor";
import type { Profile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/utils/use-hydrated";
import { describeExpiry, isStatusActive } from "@/lib/utils/status";
import { MobileLink } from "./mobile-link";
import { RootHeader } from "./screen-header";
import { Sheet } from "./sheet";
import { TabScroll } from "./tab-scroll";
import { RoundFace } from "./ui";

/** A grouped card of rows (design: Mobile Core Screens → You). */
export function SettingsGroup({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mx-[16px] overflow-hidden rounded-[12px] border border-border bg-bg-card", className)}>
      {title && (
        <h2 className="px-[16px] pt-[11px] pb-[9px] text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      )}
      {children}
    </section>
  );
}

/** A row that opens a screen: a 30px icon tile, the label, the current value, a chevron. */
export function SettingsLinkRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <MobileLink
      href={href}
      className="flex items-center gap-[13px] border-t border-border-subtle px-[16px] py-[13px] first:border-t-0 active:bg-bg-hover"
    >
      <span className="grid size-[30px] shrink-0 place-items-center rounded-[8px] border border-border-subtle bg-bg-chip text-fg-600 [&>svg]:size-[15px]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{label}</span>
      {value !== undefined && <span className="shrink-0 text-[13px] text-muted-foreground">{value}</span>}
      <ChevronRight className="size-[16px] shrink-0 text-tertiary" aria-hidden="true" />
    </MobileLink>
  );
}

const THEME_LABELS: Record<string, string> = { light: "Light", dark: "Dark", system: "System" };

/**
 * You, the fifth tab: who you are, your status, and the settings you
 * actually change — grouped cards, not a settings sidebar, with each row's
 * current value on it so you rarely have to open one.
 */
export function YouScreen({
  profile,
  isAdmin,
  memberCount,
  notifyValue,
  signOut,
}: {
  profile: Profile;
  isAdmin: boolean;
  memberCount: number;
  notifyValue: string;
  signOut: () => Promise<void>;
}) {
  const hydrated = useHydrated();
  const { theme } = useTheme();
  const [statusOpen, setStatusOpen] = useState(false);
  // Whether the status has lapsed depends on the moment, so decide it after hydration.
  const status = hydrated && isStatusActive(profile) ? profile : null;
  const clears = status ? describeExpiry(status.status_expires_at, profile.timezone) : null;

  return (
    <>
      <RootHeader title="You" />
      <TabScroll tab="you">
        <div className="pb-[16px]">
          <MobileLink href="/settings?section=profile" className="flex items-center gap-[14px] p-[16px] active:bg-bg-hover">
            <span className="relative block size-[56px] shrink-0">
              <RoundFace person={profile} size={56} />
              <span aria-hidden="true" className="absolute -right-px -bottom-px size-[11px] rounded-full border-2 border-bg-main bg-presence" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-semibold tracking-[-0.02em] text-ink">{profile.display_name}</span>
              <span className="mt-[2px] block truncate text-[13px] text-fg-600">
                {[profile.title, `@${profile.handle}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <ChevronRight className="size-[17px] shrink-0 text-tertiary" aria-hidden="true" />
          </MobileLink>

          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className="mx-[16px] mb-[16px] flex w-[calc(100%-32px)] items-center gap-[10px] rounded-[11px] border border-border-strong bg-bg-chip px-[13px] py-[11px] text-left active:bg-bg-subtle"
          >
            {status ? (
              <>
                <span className="text-[15px] leading-none" aria-hidden="true">
                  {status.status_emoji ?? "💬"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-body">{status.status_text || "Status set"}</span>
                {clears && <span className="shrink-0 text-[12px] text-muted-foreground">{clears.replace(/^Until/, "Clears")}</span>}
              </>
            ) : (
              <>
                <SmilePlus className="size-[16px] shrink-0 text-fg-600" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13.5px] text-muted-foreground">Set a status</span>
              </>
            )}
          </button>

          <SettingsGroup title="Preferences">
            <SettingsLinkRow href="/settings?section=notifications" icon={<Bell />} label="Notifications" value={notifyValue} />
            <SettingsLinkRow
              href="/settings?section=appearance"
              icon={<Sun />}
              label="Appearance"
              value={hydrated ? (THEME_LABELS[theme ?? "system"] ?? "System") : ""}
            />
          </SettingsGroup>

          <SettingsGroup title="Studio" className="mt-[16px]">
            {isAdmin && <SettingsLinkRow href="/settings?section=members" icon={<Users />} label="Members" value={String(memberCount)} />}
            <SettingsLinkRow href="/channels" icon={<Hash />} label="Browse channels" />
            <SettingsLinkRow href="/settings?section=account" icon={<Lock />} label="Account" />
          </SettingsGroup>

          <form action={signOut} className="p-[16px]">
            <button
              type="submit"
              className="flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[11px] border border-border-strong bg-bg-card text-[14px] font-semibold text-danger active:bg-bg-subtle"
            >
              <LogOut className="size-[16px]" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </TabScroll>

      <Sheet open={statusOpen} onOpenChange={setStatusOpen} title="Your status" blur={false}>
        <div className="min-h-0 overflow-y-auto">
          <StatusEditor profile={profile} onDone={() => setStatusOpen(false)} className="w-full" />
        </div>
      </Sheet>
    </>
  );
}

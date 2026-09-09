"use client";

import { ProfileCard } from "./profile-card";

/** An @mention of a person: an accent chip that opens their profile card on hover, click or Enter. */
export function MentionChip({ id, label }: { id: string; label: string }) {
  return (
    <ProfileCard userId={id}>
      <button
        type="button"
        data-mention-id={id}
        className="rounded-[5px] border border-accent-surface-border bg-accent-surface px-1 py-px font-semibold text-accent-foreground hover:border-accent-border-hover"
      >
        @{label}
      </button>
    </ProfileCard>
  );
}

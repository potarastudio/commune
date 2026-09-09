"use client";

import { ProfileCard } from "./profile-card";

/** An @mention of a person: a chip that opens their profile card on hover, click or Enter. */
export function MentionChip({ id, label }: { id: string; label: string }) {
  return (
    <ProfileCard userId={id}>
      <button
        type="button"
        data-mention-id={id}
        className="rounded bg-mention px-1 font-medium text-mention-foreground hover:bg-mention-self focus-visible:outline-2 focus-visible:outline-ring"
      >
        @{label}
      </button>
    </ProfileCard>
  );
}

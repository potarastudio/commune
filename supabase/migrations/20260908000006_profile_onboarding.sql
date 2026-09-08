-- First-run profile setup (§5 Phase 1). Null until the user has confirmed
-- their display name, handle and avatar on the welcome screen.
alter table public.profiles add column onboarded_at timestamptz;
comment on column public.profiles.onboarded_at is 'Set when first-run profile setup is completed.';

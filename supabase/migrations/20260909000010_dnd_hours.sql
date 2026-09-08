-- Do Not Disturb hours (§5 Phase 2): no push between dnd_start and dnd_end
-- in the user's own timezone. Both null = never disturb-free.
alter table public.profiles
  add column dnd_start time,
  add column dnd_end time;
comment on column public.profiles.dnd_start is 'Local time (profile timezone) when Do Not Disturb begins.';
comment on column public.profiles.dnd_end is 'Local time (profile timezone) when Do Not Disturb ends.';

-- push_subscriptions.keys holds {p256dh, auth} from PushSubscription.toJSON().
create index if not exists push_subscriptions_endpoint_idx on public.push_subscriptions (endpoint);

-- Commune: realtime
-- Postgres Changes on messages/reactions (filtered client-side by container).
-- Full replica identity so DELETE/UPDATE events carry the filter columns.
-- Presence/typing use Supabase Presence topics and need no schema.

alter table public.messages replica identity full;
alter table public.reactions replica identity full;
alter table public.channel_members replica identity full;
alter table public.huddles replica identity full;
alter table public.huddle_participants replica identity full;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.channel_members;
alter publication supabase_realtime add table public.huddles;
alter publication supabase_realtime add table public.huddle_participants;

-- Status, name and avatar changes reach open tabs live (profile cards, sidebar).
-- profiles is readable by every member, so RLS lets the feed through.
alter publication supabase_realtime add table public.profiles;

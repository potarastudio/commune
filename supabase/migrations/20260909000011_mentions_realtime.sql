-- In-app mention alerts listen to the mentions table (RLS-filtered per user).
alter table public.mentions replica identity full;
alter publication supabase_realtime add table public.mentions;

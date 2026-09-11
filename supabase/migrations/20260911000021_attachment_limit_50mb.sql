-- Attachments: 25 MB -> 50 MB per file.
--
-- 50 MB is the project-wide ceiling on the Supabase Free plan; the Management
-- API refuses anything higher until the organisation is on a paid plan. The
-- same number lives in lib/utils/files.ts (MAX_ATTACHMENT_BYTES); change both.

alter table public.attachments drop constraint attachments_size_check;
alter table public.attachments
  add constraint attachments_size_check check (size_bytes is null or size_bytes between 0 and 52428800);

update storage.buckets set file_size_limit = 52428800 where id = 'attachments';

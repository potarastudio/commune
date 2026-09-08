-- RLS tests (§8 hard requirement): a non-member cannot read a private
-- channel's messages or attachments, plus the other §4 principles.
-- Run with `supabase test db` (pgTAP) or `pnpm test:rls` (local shim).
begin;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pgtap') then
    create extension if not exists pgtap with schema extensions;
  end if;
end $$;
set local search_path = public, extensions;

select plan(52);

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser)
-- ---------------------------------------------------------------------------
create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into public.allowed_emails (email) values
  ('rls-alice@test.local'), ('rls-bob@test.local'), ('rls-mallory@test.local');

-- alice may already be second+ user (seed present) so promote explicitly below.
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'rls-alice@test.local', '{"full_name":"Alice"}'),
  ('10000000-0000-4000-8000-000000000002', 'rls-bob@test.local', '{"full_name":"Bob"}'),
  ('10000000-0000-4000-8000-000000000003', 'rls-mallory@test.local', '{"full_name":"Mallory"}');
update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'member' where id in ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003');

select is(
  (select count(*) from public.channel_members cm join public.channels c on c.id = cm.channel_id
    where c.name = 'general' and cm.user_id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003')),
  3::bigint, 'handle_new_user auto-joins #general');

select throws_ok(
  $$ insert into auth.users (id, email) values ('10000000-0000-4000-8000-000000000009', 'nobody@evil.local') $$,
  'P0001', null, 'sign-up with an email not on the allowlist is rejected');

-- Private channel with alice + bob; mallory is not a member.
insert into public.channels (id, name, is_private, created_by)
  values ('20000000-0000-4000-8000-000000000001', 'rls-secret', true, '10000000-0000-4000-8000-000000000001');
insert into public.channel_members (channel_id, user_id)
  values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')
  on conflict do nothing;

-- Public channel with alice only.
insert into public.channels (id, name, is_private, created_by)
  values ('20000000-0000-4000-8000-000000000002', 'rls-open', false, '10000000-0000-4000-8000-000000000001');

-- Alice posts in the private channel with an attachment.
insert into public.messages (id, channel_id, author_id, content, content_text)
  values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000001',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"top secret launch date"}]}]}',
          'top secret launch date');
insert into storage.objects (bucket_id, name, owner)
  values ('attachments', '10000000-0000-4000-8000-000000000001/abc/secret.pdf', '10000000-0000-4000-8000-000000000001');
insert into public.attachments (message_id, storage_path, file_name)
  values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/abc/secret.pdf', 'secret.pdf');

-- Alice posts in the public channel.
insert into public.messages (id, channel_id, author_id, content, content_text)
  values ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000001',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello open world"}]}]}',
          'hello open world');

-- ---------------------------------------------------------------------------
-- Mallory (non-member) vs the private channel
-- ---------------------------------------------------------------------------
select pg_temp.login('10000000-0000-4000-8000-000000000003');

select is((select count(*) from public.channels where id = '20000000-0000-4000-8000-000000000001'), 0::bigint,
  'non-member cannot see the private channel');
select is((select count(*) from public.messages where channel_id = '20000000-0000-4000-8000-000000000001'), 0::bigint,
  'non-member cannot read private channel messages');
select is((select count(*) from public.attachments where message_id = '30000000-0000-4000-8000-000000000001'), 0::bigint,
  'non-member cannot read private channel attachment rows');
select is((select count(*) from storage.objects where bucket_id = 'attachments'
  and name = '10000000-0000-4000-8000-000000000001/abc/secret.pdf'), 0::bigint,
  'non-member cannot read private channel attachment objects');
select is(public.can_read_message('30000000-0000-4000-8000-000000000001'), false,
  'can_read_message() is false for a non-member');
select is((select count(*) from public.channel_members where channel_id = '20000000-0000-4000-8000-000000000001'), 0::bigint,
  'non-member cannot list private channel members');
select is((select count(*) from public.search_messages('secret')), 0::bigint,
  'search does not leak private channel messages');

select throws_ok(
  $$ insert into public.channel_members (channel_id, user_id)
     values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003') $$,
  '42501', null, 'non-member cannot join a private channel');
select throws_ok(
  $$ select public.insert_message('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}'::jsonb,
       '20000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'non-member cannot post to a private channel');
select throws_ok(
  $$ insert into public.reactions (message_id, user_id, emoji)
     values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '👀') $$,
  '42501', null, 'non-member cannot react to a private channel message');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('attachments', '10000000-0000-4000-8000-000000000001/xyz/forged.pdf', '10000000-0000-4000-8000-000000000003') $$,
  '42501', null, 'cannot upload into another user''s attachment folder');

-- Public channel: browsable before joining, but posting requires membership.
select is((select count(*) from public.messages where channel_id = '20000000-0000-4000-8000-000000000002'), 1::bigint,
  'non-member can read public channel messages');
select throws_ok(
  $$ select public.insert_message('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}'::jsonb,
       '20000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'non-member cannot post to a public channel before joining');
select lives_ok(
  $$ insert into public.channel_members (channel_id, user_id)
     values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003') $$,
  'member can join a public channel');
select lives_ok(
  $$ select public.insert_message('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}'::jsonb,
       '20000000-0000-4000-8000-000000000002') $$,
  'member can post after joining');

-- Cannot impersonate.
select throws_ok(
  $$ insert into public.messages (channel_id, author_id, content, content_text)
     values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '{"type":"doc"}', 'forged') $$,
  '42501', null, 'cannot post as another user');

-- Profiles: readable, own row editable, role locked.
select is((select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 1::bigint,
  'members can read other profiles');
select lives_ok($$ update public.profiles set title = 'Intern' where id = '10000000-0000-4000-8000-000000000003' $$,
  'member can edit own profile');
select throws_ok($$ update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000003' $$,
  '42501', null, 'member cannot promote themselves');
update public.profiles set title = 'Hacked' where id = '10000000-0000-4000-8000-000000000001';
select isnt((select title from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'Hacked',
  'member cannot edit another profile');

-- allowed_emails: hidden from members.
select is((select count(*) from public.allowed_emails), 0::bigint, 'members cannot read the allowlist');
select throws_ok($$ insert into public.allowed_emails (email) values ('friend@evil.local') $$,
  '42501', null, 'members cannot add to the allowlist');

-- #general: cannot leave.
select throws_ok(
  $$ delete from public.channel_members where user_id = '10000000-0000-4000-8000-000000000003'
     and channel_id = (select id from public.channels where name = 'general') $$,
  '42501', null, 'cannot leave #general');

-- ---------------------------------------------------------------------------
-- Bob (member) vs the private channel
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('10000000-0000-4000-8000-000000000002');

select is((select count(*) from public.messages where channel_id = '20000000-0000-4000-8000-000000000001'), 1::bigint,
  'member can read private channel messages');
select is((select count(*) from public.attachments where message_id = '30000000-0000-4000-8000-000000000001'), 1::bigint,
  'member can read private channel attachment rows');
select is((select count(*) from storage.objects where bucket_id = 'attachments'
  and name = '10000000-0000-4000-8000-000000000001/abc/secret.pdf'), 1::bigint,
  'member can read private channel attachment objects');
select is((select count(*) from public.search_messages('secret')), 1::bigint,
  'search returns private channel messages to members');
select lives_ok(
  $$ insert into public.reactions (message_id, user_id, emoji)
     values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '🔥') $$,
  'member can react');

-- Only the author edits; bob's update touches 0 rows.
update public.messages set content_text = 'edited by bob' where id = '30000000-0000-4000-8000-000000000001';
select is((select content_text from public.messages where id = '30000000-0000-4000-8000-000000000001'), 'top secret launch date',
  'non-author cannot edit a message');

-- Thread reply via insert_message inherits the container; "also send" creates a copy.
select lives_ok(
  $$ select public.insert_message(
       '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"10000000-0000-4000-8000-000000000001","label":"alice"}},{"type":"text","text":" agreed"}]}]}'::jsonb,
       null, null, '30000000-0000-4000-8000-000000000001', null, '[]'::jsonb, true) $$,
  'member can reply in a thread with also-send-to-channel');
select is((select reply_count from public.messages where id = '30000000-0000-4000-8000-000000000001'), 1,
  'reply_count is maintained by trigger');
select is((select count(*) from public.messages where channel_id = '20000000-0000-4000-8000-000000000001' and parent_id is null), 2::bigint,
  'also-send-to-channel posted a copy to the channel');
select is((select count(*) from public.mentions mn join public.messages m on m.id = mn.message_id
  where m.channel_id = '20000000-0000-4000-8000-000000000001' and mn.user_id = '10000000-0000-4000-8000-000000000001'), 2::bigint,
  'mentions are extracted server-side from the Tiptap JSON');

-- DMs: created via get_or_create_conversation and deduplicated.
select lives_ok($$ select public.get_or_create_conversation(array['10000000-0000-4000-8000-000000000001']::uuid[]) $$,
  'member can open a DM');
select is(
  public.get_or_create_conversation(array['10000000-0000-4000-8000-000000000001']::uuid[]),
  public.get_or_create_conversation(array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002']::uuid[]),
  'the same member set reuses the conversation');
select throws_ok(
  $$ select public.get_or_create_conversation(array['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',
       '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003',
       '10000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000007']::uuid[]) $$,
  'P0001', null, 'group DMs are capped at 8 people');

-- Mallory cannot see the alice/bob DM.
reset role;
select pg_temp.login('10000000-0000-4000-8000-000000000003');
select is((select count(*) from public.conversations), 0::bigint, 'non-member cannot see others'' conversations');

-- ---------------------------------------------------------------------------
-- Alice (admin)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
select is((select count(*) from public.allowed_emails where email like 'rls-%'), 3::bigint, 'admin can read the allowlist');
select lives_ok($$ update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000002' $$,
  'admin can promote a member');
update public.messages set deleted_at = now()
  where channel_id = '20000000-0000-4000-8000-000000000001'
    and author_id = '10000000-0000-4000-8000-000000000002' and parent_id is not null;
select is((select count(*) from public.messages where channel_id = '20000000-0000-4000-8000-000000000001'
  and author_id = '10000000-0000-4000-8000-000000000002' and parent_id is not null and deleted_at is not null), 1::bigint,
  'admin can soft-delete any message');
select is((select reply_count from public.messages where id = '30000000-0000-4000-8000-000000000001'), 0,
  'soft-deleting a reply decrements reply_count');


-- ---------------------------------------------------------------------------
-- Edit, pin, save (as Bob, member of the private channel)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('10000000-0000-4000-8000-000000000002');

select throws_ok(
  $$ select public.update_message('30000000-0000-4000-8000-000000000001',
       '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"bob was here"}]}]}'::jsonb) $$,
  '42501', null, 'non-author cannot edit through update_message');

select lives_ok(
  $$ insert into public.pins (message_id, pinned_by) values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002') $$,
  'member can pin a message in their channel');
select lives_ok(
  $$ insert into public.saved_messages (user_id, message_id) values ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001') $$,
  'member can save a readable message');
select throws_ok(
  $$ insert into public.saved_messages (user_id, message_id) values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'cannot save a message on behalf of someone else');

-- Alice edits her own message: content, content_text and mentions all move together.
reset role;
select pg_temp.login('10000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.update_message('30000000-0000-4000-8000-000000000001',
       '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"launch date moved "},{"type":"mention","attrs":{"id":"10000000-0000-4000-8000-000000000002","label":"bob"}}]}]}'::jsonb) $$,
  'author can edit through update_message');
select is((select content_text from public.messages where id = '30000000-0000-4000-8000-000000000001'), 'launch date moved @bob',
  'update_message derives content_text');
select is((select is_edited from public.messages where id = '30000000-0000-4000-8000-000000000001'), true,
  'update_message flags the message as edited');
select is((select count(*) from public.mentions where message_id = '30000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000002'), 1::bigint,
  'update_message re-syncs mentions');

-- Mallory still sees none of it.
reset role;
select pg_temp.login('10000000-0000-4000-8000-000000000003');
select is((select count(*) from public.pins where message_id = '30000000-0000-4000-8000-000000000001'), 0::bigint,
  'non-member cannot see pins in a private channel');

reset role;
select * from finish();
rollback;

-- Commune seed (§9): 3 users (Hakim as admin), #general, #random, #design,
-- ~200 messages with threads, reactions and mentions, plus a DM and a group DM.
-- Runs after migrations on `supabase db reset`. Idempotent per reset (fresh DB).
--
-- ⚠️  Set v_founder_email to the Google account you sign in with. GoTrue links a
-- Google identity to an existing auth.users row with the same verified email,
-- so you will land in the seeded admin account.

do $$
declare
  v_founder_email text := 'hi@potarastudio.com';

  u_hakim uuid := '00000000-0000-4000-8000-000000000001';
  u_nadia uuid := '00000000-0000-4000-8000-000000000002';
  u_raka  uuid := '00000000-0000-4000-8000-000000000003';
  v_users uuid[] := array['00000000-0000-4000-8000-000000000001',
                          '00000000-0000-4000-8000-000000000002',
                          '00000000-0000-4000-8000-000000000003']::uuid[];

  c_general uuid;
  c_random  uuid;
  c_design  uuid;
  v_dm      uuid;
  v_group   uuid;

  general_lines text[] := array[
    'Morning all! Reminder that the Bluebird kickoff is at 10.',
    'Office wifi is being flaky again, IT is on it.',
    'Timesheets for last week are due by 3pm today, please.',
    'Welcome to Commune. This is where we talk now. Slack is on notice.',
    'Client feedback on the Kopi Nusantara deck just landed, reading now.',
    'Who has the Figma license key for the new Mac?',
    'Lunch order: nasi padang or ramen? Vote with reactions.',
    'Heads up, I will be out Thursday afternoon for a dentist thing.',
    'Q3 retro is Friday at 4. Bring one thing that annoyed you and one thing that did not.',
    'The Bluebird brand book PDF is in the shared drive under Clients/Bluebird/Deliverables.',
    'Can someone review the invoice draft for Sarana before it goes out?',
    'Aircon in the big meeting room is fixed.',
    'New hire starting Monday. Please be nice and hide the broken chair.',
    'Anyone free for a quick sanity check on a logo lockup?',
    'Server maintenance tonight 11pm to midnight, the file server will be down.',
    'Reminder: Potara is closed for the public holiday on the 17th.',
    'Bluebird signed the SOW. Kickoff Tuesday.',
    'Uploading the photoshoot selects now, 40 images, please pick your top 10.',
    'Do we still have the Muji notebooks? The client loved them last time.',
    'Sprint planning moved to 2pm. Same room.',
    'Great work on the pitch yesterday everyone. They were genuinely impressed.',
    'Someone left a laptop charger in the kitchen. USB-C, white.',
    'Thanks for covering my calls yesterday!',
    'The printer is jammed again. I have given up.',
    'PSA: the shared Google Drive is 92% full. Please archive old projects.'
  ];

  random_lines text[] := array[
    'This coffee is unreasonably good today.',
    'Has anyone seen the new Nolan film yet? No spoilers.',
    'Rain again. Jakarta traffic is going to be a disaster.',
    'Found a font that looks exactly like our old logo. Cursed.',
    'Is it bad that I have opinions about the office spoons?',
    'Playlist for the studio today: lo-fi or 90s?',
    'Someone brought martabak. Kitchen. Go now.',
    'My cat sat on my keyboard and closed Figma without saving.',
    'Pixel art Friday? I made a tiny Potara logo.',
    'Weekend plans: sleep. That is it. That is the plan.',
    'The new Blender release looks wild.',
    'Hot take: Comic Sans is fine in moderation.',
    'Who keeps changing the thermostat to 18 degrees?',
    'Just discovered the espresso machine has a hidden ristretto mode.',
    'Anyone want to do a design book swap this month?',
    'Cannot stop watching kinetic typography videos.',
    'I have been awake since 5am for no reason. Send help.',
    'The office plant has a name now. It is Gerald.',
    'Gerald is thriving.',
    'Anyone up for badminton after work?'
  ];

  design_lines text[] := array[
    'Uploaded v3 of the Bluebird homepage. Hero is tighter, CTA moved above the fold.',
    'I am not sold on the serif for headings. It fights the logo.',
    'Can we try the 8pt grid for the dashboard instead of 4pt? Feels too dense.',
    'Colour contrast on the secondary button fails AA in dark mode. Fixing.',
    'The icon set is inconsistent, some are 1.5px stroke and some are 2px.',
    'Reference: the way Linear handles empty states is really clean.',
    'Type scale proposal: 12/14/16/20/24/32/40. Thoughts?',
    'Motion spec for the onboarding flow is in the Figma prototype tab.',
    'Client wants the logo bigger. Again.',
    'I tried a warmer neutral palette and honestly it works better with the photography.',
    'Card radius: 8 or 12? I keep flip-flopping.',
    'Rebuilt the component library with variables. Theme switching is one toggle now.',
    'Can someone check the mobile nav on a real device? Safari is doing something weird.',
    'The illustration style guide is ready for review.',
    'Spacing audit done. Found 14 places using magic numbers.',
    'We should document the elevation tokens before the dev handoff.',
    'Kopi Nusantara packaging dielines attached. Print needs 3mm bleed.',
    'Dark mode pass on the settings screens is done.',
    'Should the sidebar collapse on tablet or just get narrower?',
    'New Inter release fixes the weird apostrophe. Updating the design system.',
    'Interaction states for the composer: hover, focus, active, disabled. All in the file.',
    'I think we are over-animating the dashboard. Cut half of it.',
    'Accessibility review notes are in the Notion doc, mostly focus order.',
    'The pitch deck template is updated with the new brand colours.',
    'Exported all the marketing assets at 1x 2x 3x, they are in the drive.'
  ];

  reply_lines text[] := array[
    'Agreed, let us go with that.',
    'Hmm, not sure. Can you share a screenshot?',
    'Looks great to me!',
    'I can take this one.',
    'Let me check and get back to you after lunch.',
    'Nice catch, fixing now.',
    'Can we discuss this in the standup tomorrow?',
    'This is exactly what the client asked for, thanks.',
    'Second this.',
    'Done.',
    'Ha, classic.',
    'I have a slightly different take, will write it up.',
    'Approved from my side.',
    'Should we loop in the client on this?',
    'Yes please.'
  ];

  emojis text[] := array['👍', '🔥', '❤️', '😂', '👀', '🎉', '✅', '💯'];

  -- working buffers
  v_lines  text[];
  v_text   text;
  v_content jsonb;
  v_author uuid;
  v_msg    uuid;
  v_reply  uuid;
  v_ts     timestamptz;
  v_day    int;
  v_i      int;
  v_j      int;
  v_k      int;
  v_channel uuid;
  v_n_replies int;
  v_reactor uuid;
  v_general_count int := 0;
begin
  -- Allowlist first: handle_new_user() rejects anything not on it.
  insert into public.allowed_emails (email) values
    (v_founder_email),
    ('nadia@potara.studio'),
    ('raka@potara.studio')
  on conflict do nothing;

  -- auth.users → handle_new_user() creates profiles and joins #general.
  -- Hakim is first, so becomes admin.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', u_hakim, 'authenticated', 'authenticated', v_founder_email, null, now(),
     '{"provider":"google","providers":["google"]}', jsonb_build_object('full_name', 'Hakim Haiman', 'avatar_url', 'https://api.dicebear.com/9.x/notionists/svg?seed=hakim'),
     now() - interval '30 days', now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u_nadia, 'authenticated', 'authenticated', 'nadia@potara.studio', null, now(),
     '{"provider":"google","providers":["google"]}', jsonb_build_object('full_name', 'Nadia Putri', 'avatar_url', 'https://api.dicebear.com/9.x/notionists/svg?seed=nadia'),
     now() - interval '29 days', now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', u_raka, 'authenticated', 'authenticated', 'raka@potara.studio', null, now(),
     '{"provider":"google","providers":["google"]}', jsonb_build_object('full_name', 'Raka Pratama', 'avatar_url', 'https://api.dicebear.com/9.x/notionists/svg?seed=raka'),
     now() - interval '28 days', now(), '', '', '', '');

  update public.profiles set handle = 'hakim', title = 'Founder & Design Lead', status_emoji = '🎧', status_text = 'Heads down' where id = u_hakim;
  update public.profiles set handle = 'nadia', title = 'Product Designer' where id = u_nadia;
  update public.profiles set handle = 'raka',  title = 'Brand Designer', status_emoji = '🌴', status_text = 'On leave Friday' where id = u_raka;

  select id into c_general from public.channels where name = 'general';
  select id into c_random  from public.channels where name = 'random';

  insert into public.channels (name, topic, description, created_by)
  values ('design', 'Crit, references, and work in progress', 'Post work early. Feedback is a gift.', u_hakim)
  returning id into c_design;

  -- Everyone joins every seeded channel.
  insert into public.channel_members (channel_id, user_id)
  select c, u from unnest(array[c_general, c_random, c_design]) c cross join unnest(v_users) u
  on conflict do nothing;

  -- ------------------------------------------------------------------------
  -- ~200 channel messages over the last 14 days, 09:00–18:00 Jakarta time
  -- ------------------------------------------------------------------------
  for v_i in 1..200 loop
    v_day := 14 - ((v_i - 1) * 14 / 200);       -- older first, so created_at increases
    v_ts := (date_trunc('day', now() at time zone 'Asia/Jakarta') - make_interval(days => v_day)
             + make_interval(hours => 9) + make_interval(mins => ((v_i * 37) % 540))) at time zone 'Asia/Jakarta';

    case (v_i % 5)
      when 0 then v_channel := c_random;  v_lines := random_lines;
      when 1 then v_channel := c_general; v_lines := general_lines;
      when 2 then v_channel := c_design;  v_lines := design_lines;
      when 3 then v_channel := c_design;  v_lines := design_lines;
      else        v_channel := c_general; v_lines := general_lines;
    end case;

    v_author := v_users[1 + ((v_i * 7) % 3)];
    v_text := v_lines[1 + ((v_i * 13) % array_length(v_lines, 1))];

    -- Every 9th message mentions someone; every 25th uses @channel.
    if v_i % 25 = 0 then
      v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
          jsonb_build_object('type', 'mention', 'attrs', jsonb_build_object('id', 'channel', 'label', 'channel')),
          jsonb_build_object('type', 'text', 'text', ' ' || v_text)))));
    elsif v_i % 9 = 0 then
      v_reactor := v_users[1 + ((v_i * 11) % 3)];
      if v_reactor = v_author then v_reactor := v_users[1 + ((v_i * 11 + 1) % 3)]; end if;
      v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
          jsonb_build_object('type', 'mention', 'attrs', jsonb_build_object('id', v_reactor::text,
            'label', (select handle from public.profiles where id = v_reactor))),
          jsonb_build_object('type', 'text', 'text', ' ' || v_text)))));
    elsif v_i % 17 = 0 then
      v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', v_text))),
        jsonb_build_object('type', 'codeBlock', 'attrs', jsonb_build_object('language', 'css'), 'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', E'--radius-md: 8px;\n--radius-lg: 12px;')))));
    else
      v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', v_text)))));
    end if;

    insert into public.messages (channel_id, author_id, content, content_text, created_at)
    values (v_channel, v_author, v_content, btrim(public.tiptap_to_text(v_content)), v_ts)
    returning id into v_msg;

    insert into public.mentions (message_id, user_id, kind)
    select v_msg, em.user_id, em.kind from public.extract_mentions(v_content) em
    on conflict do nothing;

    -- Reactions on roughly a third of messages.
    if v_i % 3 = 0 then
      for v_k in 1..(1 + (v_i % 3)) loop
        v_reactor := v_users[1 + ((v_i + v_k) % 3)];
        insert into public.reactions (message_id, user_id, emoji, created_at)
        values (v_msg, v_reactor, emojis[1 + ((v_i * v_k) % array_length(emojis, 1))], v_ts + make_interval(mins => v_k))
        on conflict do nothing;
      end loop;
    end if;

    -- Threads on every 8th message: 2–5 replies.
    if v_i % 8 = 0 then
      v_n_replies := 2 + (v_i % 4);
      for v_j in 1..v_n_replies loop
        v_reactor := v_users[1 + ((v_i + v_j * 5) % 3)];
        v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
          jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', reply_lines[1 + ((v_i + v_j * 3) % array_length(reply_lines, 1))])))));
        insert into public.messages (channel_id, author_id, parent_id, content, content_text, created_at)
        values (v_channel, v_reactor, v_msg, v_content, btrim(public.tiptap_to_text(v_content)),
                v_ts + make_interval(mins => v_j * 4))
        returning id into v_reply;
        if v_j = 1 then
          insert into public.reactions (message_id, user_id, emoji) values (v_reply, v_author, '👍') on conflict do nothing;
        end if;
      end loop;
    end if;

    -- A couple of pins and saved messages for the Phase 3 views.
    if v_i in (5, 41) then
      insert into public.pins (message_id, pinned_by) values (v_msg, u_hakim) on conflict do nothing;
    end if;
    if v_i in (12, 66, 130) then
      insert into public.saved_messages (user_id, message_id) values (u_hakim, v_msg) on conflict do nothing;
    end if;
  end loop;

  -- One edited and one soft-deleted message so the UI states are visible.
  update public.messages set content = jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Timesheets for last week are due by 5pm today (extended), please.'))))),
    content_text = 'Timesheets for last week are due by 5pm today (extended), please.'
  where id = (select id from public.messages where channel_id = c_general and parent_id is null order by created_at desc offset 3 limit 1);

  update public.messages set deleted_at = now()
  where id = (select id from public.messages where channel_id = c_random and parent_id is null order by created_at desc offset 2 limit 1);

  -- ------------------------------------------------------------------------
  -- DMs: Hakim ↔ Nadia, and a group DM of all three
  -- ------------------------------------------------------------------------
  insert into public.conversations (id) values ('00000000-0000-4000-8000-00000000d001') returning id into v_dm;
  insert into public.conversation_members (conversation_id, user_id) values (v_dm, u_hakim), (v_dm, u_nadia);

  insert into public.conversations (id) values ('00000000-0000-4000-8000-00000000d002') returning id into v_group;
  insert into public.conversation_members (conversation_id, user_id) values (v_group, u_hakim), (v_group, u_nadia), (v_group, u_raka);

  for v_i in 1..12 loop
    v_author := case when v_i % 2 = 0 then u_hakim else u_nadia end;
    v_text := (array[
      'Hey, got a minute to look at the Bluebird hero?',
      'Sure, sending the link.',
      'The type feels a touch heavy at that size.',
      'Agreed. Trying 500 weight instead of 600.',
      'Much better. Ship it.',
      'Also, are you around for the client call at 3?',
      'Yes, I will dial in from the small room.',
      'Perfect. I will send the agenda.',
      'One more thing, the invoice for Sarana is approved.',
      'Great, sending it now.',
      'Thanks for today. Good session.',
      'Anytime!'])[v_i];
    v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', v_text)))));
    insert into public.messages (conversation_id, author_id, content, content_text, created_at)
    values (v_dm, v_author, v_content, v_text, now() - make_interval(hours => 30 - v_i * 2));
  end loop;

  for v_i in 1..6 loop
    v_author := v_users[1 + (v_i % 3)];
    v_text := (array[
      'Group DM test: does this thing work?',
      'It works.',
      'Nice. Retro snacks: who is bringing what?',
      'I have got the martabak covered.',
      'I will bring the good coffee.',
      'Then I am bringing Gerald.'])[v_i];
    v_content := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', v_text)))));
    insert into public.messages (conversation_id, author_id, content, content_text, created_at)
    values (v_group, v_author, v_content, v_text, now() - make_interval(hours => 8 - v_i));
  end loop;

  -- Leave a few things unread for Hakim so badges show on first load.
  update public.channel_members set last_read_at = now() - interval '2 days' where user_id = u_hakim and channel_id in (c_design, c_random);
  update public.conversation_members set last_read_at = now() - interval '1 day' where user_id = u_hakim;
end $$;

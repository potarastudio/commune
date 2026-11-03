-- The Potara Hub account wears the Hub's own app icon, so its DMs are known at
-- a glance. public/avatars/potara-hub.svg is a copy of the Hub's
-- src/app/icon.svg. The path is same-site on purpose: avatars only render
-- inside the app, and the browser, desktop and phone shells all load it from
-- commune.potarastudio.com. Deploy the code (which ships the file) before
-- pushing this, or the avatar points at nothing until it does.

update public.profiles
set avatar_url = '/avatars/potara-hub.svg'
where id = 'b0000000-0000-4000-8000-000000000001' and avatar_url is null;

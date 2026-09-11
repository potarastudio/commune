# Commune — Build Brief

Commune is a Slack-style team chat app for Potara Studio (a ~12-person design agency). Web app first. Single workspace. Everyone who signs in with an allowlisted Google account is a member of Potara.

This file is the source of truth for the project. Read it fully before making changes. When a decision here conflicts with something you'd normally do, follow this file. If you think a decision is wrong, say so and ask before deviating.

---

## 1. Goals and non-goals

**Goal:** replace Slack for daily use by a 10–15 person team: channels, DMs, threads, reactions, file sharing, search, mentions, notifications, and huddles (audio/video with screen share).

**Non-goals for now:** mobile apps, multi-workspace, third-party integrations/bots, message retention policies, enterprise admin. Do not build these unless asked. (A desktop app was a non-goal until 2026-09-11; see §11.)

**Quality bar:** it should feel as fast and polished as Slack for the features it has. Fewer features done well beats many features done half-way. The founder is a UI/UX designer — visual craft matters and will be reviewed closely.

---

## 2. Stack (fixed — do not swap without asking)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict | Server Components by default; `"use client"` only where interaction needs it |
| Styling | Tailwind CSS + shadcn/ui | shadcn components live in `components/ui/` and may be restyled freely |
| Composer | Tiptap | Rich text, @mentions, emoji, code blocks, links. Store content as Tiptap JSON |
| Data fetching | TanStack Query | All client-side reads/mutations go through query hooks in `lib/queries/` |
| Client state | Zustand | Only for UI state (open channel, open thread, composer drafts). Never cache server data in Zustand |
| Backend | Supabase | Postgres, Auth (Google OAuth), Storage, Realtime, Edge Functions |
| Realtime | Supabase Realtime | Postgres Changes for messages/reactions; Presence for online status + typing |
| Huddles | LiveKit Cloud | `@livekit/components-react`. Tokens minted server-side via a Route Handler |
| Search | Postgres full-text search (`tsvector`) | No external search service |
| Email | Resend | Invites, mention digests |
| Push | Web Push API + service worker | Browser notifications only |
| Hosting | Vercel | Preview deploys per PR |
| Validation | Zod | Every Route Handler and Server Action validates input with Zod |
| Testing | Vitest + Playwright | See §8 |

Package manager: **pnpm**. Node 20+.

---

## 3. Project structure

```
app/
  (auth)/login/            # Google sign-in page
  (app)/                   # Authenticated shell (sidebar + main pane)
    layout.tsx
    channel/[channelId]/   # Channel view; ?thread=<messageId> opens thread panel
    dm/[conversationId]/
    huddle/[roomId]/       # Full-screen huddle view (also embeddable as a dock)
    search/
    settings/
  api/
    livekit/token/route.ts
    push/subscribe/route.ts
    unfurl/route.ts
components/
  ui/                      # shadcn primitives (restyled)
  sidebar/
  message/                 # MessageList, MessageItem, MessageComposer, ReactionBar
  thread/
  huddle/
  search/
lib/
  supabase/                # client.ts (browser), server.ts (RSC/route), admin.ts (service role)
  queries/                 # TanStack hooks: useMessages, useChannels, ...
  realtime/                # Channel subscriptions, presence helpers
  livekit/
  push/
  utils/
supabase/
  migrations/              # SQL migrations (source of truth for the schema)
  seed.sql
  functions/               # Edge Functions (unfurl, notify)
types/
  database.ts              # Generated: `pnpm supabase gen types typescript`
desktop/                   # Electron shell for Mac and Windows (§11); its own package
```

Rules:
- Schema changes are made **only** through SQL migrations in `supabase/migrations/`. Never edit the database from the dashboard.
- Regenerate `types/database.ts` after every migration.
- No direct `supabase.from(...)` calls inside components. Go through `lib/queries/`.

---

## 4. Data model

Build this first, exactly, before any UI. Everything else hangs off it.

### Tables

**profiles** — one row per user, mirrors `auth.users`
- `id uuid PK references auth.users`
- `email text unique not null`
- `display_name text not null`
- `handle text unique not null` — e.g. `hakim`, used for @mentions
- `avatar_url text`
- `title text` — job title shown on profile card
- `status_text text`, `status_emoji text`, `status_expires_at timestamptz`
- `timezone text default 'Asia/Jakarta'`
- `role text not null default 'member'` — `'admin' | 'member'`
- `created_at timestamptz default now()`

**allowed_emails** — invite allowlist
- `email text PK`
- `invited_by uuid references profiles`
- `created_at timestamptz`

A Google sign-in whose email is not in `allowed_emails` is rejected (enforced in the `handle_new_user` trigger — raise an exception). Admins add emails from Settings.

**channels**
- `id uuid PK default gen_random_uuid()`
- `name text unique not null` — lowercase, `[a-z0-9-]`, max 40 chars
- `topic text`, `description text`
- `is_private boolean default false`
- `is_archived boolean default false`
- `created_by uuid references profiles`
- `created_at timestamptz`

Seed with `#general` (everyone auto-joined, cannot leave or archive) and `#random`.

**channel_members**
- `channel_id uuid references channels on delete cascade`
- `user_id uuid references profiles on delete cascade`
- `joined_at timestamptz`
- `last_read_at timestamptz default now()` — drives unread badges
- `notification_level text default 'all'` — `'all' | 'mentions' | 'muted'`
- PK `(channel_id, user_id)`

**conversations** — DMs and group DMs
- `id uuid PK`
- `created_at timestamptz`

**conversation_members**
- `conversation_id uuid references conversations on delete cascade`
- `user_id uuid references profiles on delete cascade`
- `last_read_at timestamptz default now()`
- PK `(conversation_id, user_id)`

A DM between the same set of users must be reused, not duplicated. Implement `get_or_create_conversation(user_ids uuid[])` as a Postgres function.

**messages**
- `id uuid PK`
- `channel_id uuid references channels on delete cascade` — nullable
- `conversation_id uuid references conversations on delete cascade` — nullable
- CHECK: exactly one of `channel_id` / `conversation_id` is non-null
- `author_id uuid references profiles`
- `parent_id uuid references messages on delete cascade` — non-null ⇒ this is a thread reply
- `content jsonb not null` — Tiptap document
- `content_text text not null` — plain-text render of `content`, for search and previews
- `search_vector tsvector generated always as (to_tsvector('simple', content_text)) stored`
- `reply_count int default 0`, `last_reply_at timestamptz` — maintained by trigger on insert/delete of replies
- `is_edited boolean default false`
- `edited_at timestamptz`
- `deleted_at timestamptz` — soft delete; render as "This message was deleted"
- `created_at timestamptz default now()`
- Indexes: `(channel_id, created_at desc)`, `(conversation_id, created_at desc)`, `(parent_id, created_at)`, GIN on `search_vector`

**reactions**
- `message_id uuid references messages on delete cascade`
- `user_id uuid references profiles on delete cascade`
- `emoji text not null` — unicode emoji or `:custom_name:`
- `created_at timestamptz`
- PK `(message_id, user_id, emoji)`

**attachments**
- `id uuid PK`
- `message_id uuid references messages on delete cascade`
- `storage_path text not null` — path in the `attachments` bucket
- `file_name text`, `mime_type text`, `size_bytes bigint`
- `width int`, `height int` — for images
- `created_at timestamptz`

**mentions** — denormalised so "mentions of me" and notifications are cheap
- `id uuid PK`
- `message_id uuid references messages on delete cascade`
- `user_id uuid references profiles on delete cascade` — null when `kind` ≠ `user`
- `kind text not null` — `'user' | 'channel' | 'here'`
- Unique index on `(message_id, user_id, kind)`; index on `(user_id, created_at desc)`
- `created_at timestamptz default now()`

**pins** — works for channels and DMs alike, since the message already knows its container
- `message_id uuid PK references messages on delete cascade`
- `pinned_by uuid`, `created_at timestamptz`

**saved_messages** (Slack "Saved for later")
- `user_id`, `message_id`, `created_at`; PK `(user_id, message_id)`

**huddles**
- `id uuid PK`
- `channel_id` / `conversation_id` — same exactly-one CHECK as messages
- `livekit_room text unique not null`
- `started_by uuid`, `started_at timestamptz`, `ended_at timestamptz`

**huddle_participants**
- `huddle_id`, `user_id`, `joined_at`, `left_at`; PK `(huddle_id, user_id, joined_at)`

**push_subscriptions**
- `id uuid PK`, `user_id`, `endpoint text unique`, `keys jsonb`, `user_agent text`, `created_at`

**custom_emoji**
- `name text PK` (`[a-z0-9_]`), `storage_path text`, `created_by uuid`, `created_at`

### Row Level Security (mandatory on every table)

Write policies as SQL in the migration alongside the table. Principles:
- A user can read a channel's messages iff they are a `channel_members` row for it, **or** the channel is public (public channels are browsable before joining, like Slack).
- A user can read a conversation's messages iff they are a `conversation_members` row.
- Only the author can update/delete their message; admins can delete any.
- `profiles` are readable by all members, editable only by the owner (role editable only by admin).
- `allowed_emails` readable/writable by admins only.
- Storage bucket `attachments`: read iff the user can read the message it belongs to (use a `can_read_message(message_id)` SQL function shared by table and storage policies). Bucket `avatars`: public read.

Write a helper `is_channel_member(channel_id)` and `is_conversation_member(conversation_id)` as `security definer` functions and use them in policies to avoid recursive policy checks.

### Storage buckets
- `attachments` — private, 50 MB per file limit (the Supabase Free plan ceiling; was 25 MB until 2026-09-11)
- `avatars` — public
- `emoji` — public

---

## 5. Feature scope by phase

Ship each phase to Vercel and use it with the real team before starting the next. Do not start Phase 2 work while Phase 1 has known bugs.

### Phase 1 — "We can stop using Slack for text" (MVP)
- Google sign-in with email allowlist; first-run profile setup (display name, handle, avatar)
- Sidebar: channels list (joined), DMs list, unread bold + badge counts, collapsible sections
- Channel view: infinite-scroll message list (cursor-paginated, newest at bottom), date dividers, grouped consecutive messages from same author within 5 min, hover action bar (react, reply in thread, edit, delete, copy link, pin, save)
- Composer: Tiptap with bold/italic/strike/code/code block/links/bulleted lists, @mention autocomplete, emoji picker + `:shortcode:` autocomplete, Enter sends / Shift+Enter newline, drafts persisted per channel
- Threads: side panel, reply count + avatars under parent, "also send to channel" checkbox
- Reactions: add/remove, grouped chips with tooltip listing who reacted
- DMs and group DMs (up to 8 people)
- Create/join/leave/browse channels; private channels; channel topic/description
- File upload: drag-drop, paste, or button; image previews inline; other files as cards; download
- Realtime: new messages, edits, deletes, reactions appear instantly for everyone in the view; typing indicator; online presence dot
- Unread tracking: `last_read_at` updated when the channel is visible and window focused; "New messages" divider line
- Search: `Cmd/Ctrl+K` quick switcher (channels + people); message search page with filters `from:@handle`, `in:#channel`, `before:`/`after:`
- Mentions: `@user`, `@channel`, `@here`; "Mentions & reactions" activity view
- Basic Settings: profile, notification level per channel, theme (light/dark/system)

### Phase 2 — Huddles + notifications
- Huddle button in every channel and DM header. Starting one creates a `huddles` row + LiveKit room; a banner shows "Hakim started a huddle · 3 people" with Join; participants shown with avatars
- In-huddle: mute/unmute, camera on/off, screen share, participant tiles, speaking indicator, leave. Docked mini-view so you can keep chatting while in a huddle; expand to full-screen
- Huddle ends automatically when the last participant leaves
- Web push notifications for DMs and mentions (respecting per-channel notification level and Do Not Disturb hours in settings); in-app toast when window is open but a different channel is focused
- Email digest via Resend for unread mentions older than 15 min if the user is offline
- Link unfurling (Edge Function fetches OpenGraph; cache results per URL)

### Phase 3 — Polish and parity
- Message edit history, pinned messages panel, saved messages page
- Custom emoji upload
- Channel bookmarks bar, channel details sidebar (members, files, pins)
- Keyboard shortcuts overlay (`Cmd+/`), Alt+↑/↓ channel switching, Esc to mark read
- User status (emoji + text + expiry), profile cards on hover
- Message scheduling, reminders ("remind me about this")
- Admin: manage allowlist, archive channels, delete any message, custom emoji moderation
- PWA install (manifest + service worker) so it lives in the dock like a desktop app

---

## 6. UX and design conventions

- Layout mirrors Slack: 260px sidebar, main pane, optional 400px right panel (thread / channel details / huddle). Resizable, remembered.
- Design tokens live in `app/globals.css` as CSS variables consumed by Tailwind. No hard-coded colours in components. Light and dark themes both first-class.
- Typography: Inter (UI) and JetBrains Mono (code). 14px base, 1.5 line-height in messages.
- Every interactive element has a visible focus ring and a keyboard path. Every icon-only button has a tooltip and `aria-label`.
- Optimistic updates for send, react, edit, delete — the UI never waits on the network for these. Roll back with a subtle error toast on failure.
- Empty states are designed, not blank (new channel, no search results, no DMs yet).
- Loading uses skeletons, not spinners, for lists.
- Times are shown in the viewer's timezone; default `Asia/Jakarta`.
- No modals where a popover or inline edit will do.

---

## 7. Engineering conventions

- **Server-first.** Initial channel data is fetched in Server Components and passed as `initialData` to TanStack Query hooks; the client then subscribes for realtime updates.
- **Realtime strategy.** Subscribe to Postgres Changes on `messages` and `reactions` filtered by the open `channel_id`/`conversation_id`. On event, patch the TanStack cache — do not refetch the whole list. Presence and typing use Supabase Presence on a per-channel topic; typing state expires after 3 s of no keystrokes.
- **Pagination.** Cursor-based on `(created_at, id)`, 50 messages per page. Never offset pagination.
- **Rendering messages.** A single `renderContent(tiptapJson)` in `lib/utils/render.ts` produces React. Sanitize links; `rel="noopener"`; mentions render as chips that open the profile card.
- **`content_text`** is generated server-side in the insert path (Server Action) from the Tiptap JSON — the client never sends it.
- **Mentions** are extracted server-side from the Tiptap JSON into the `mentions` table in the same transaction as the message insert (use a Postgres function `insert_message(...)` that does all of it).
- **Uploads** go direct to Supabase Storage from the browser with a signed upload URL; the message is inserted after the upload succeeds, referencing the path.
- **LiveKit tokens** are minted in `app/api/livekit/token/route.ts` only after verifying the caller can read the channel/conversation the huddle belongs to. Never expose the LiveKit API secret to the client.
- **Errors.** User-facing errors are toasts with plain language. Log the real error with context on the server.
- **Env vars** are validated at boot with Zod in `lib/env.ts`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_APP_URL`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`…). Small PRs, one feature each.

---

## 8. Testing and verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` must pass before any PR.
- Unit tests (Vitest) for: `renderContent`, mention extraction, `content_text` generation, cursor pagination helpers, unread-count logic.
- RLS tests: a SQL test file (`supabase/tests/rls.sql`, run with `pg_prove` or via a Vitest suite using two authenticated clients) proving a non-member cannot read a private channel's messages or attachments. This is a hard requirement before Phase 1 ships.
- Playwright smoke tests: sign in (mock OAuth in test env), send a message in `#general`, see it appear in a second browser context, react to it, reply in thread.
- Before marking any UI task done, take a screenshot at 1440×900 in both light and dark themes and check it against §6.

---

## 9. Local development

```bash
pnpm install
pnpm supabase start          # local Postgres + Auth + Storage + Realtime (Docker)
pnpm supabase db reset       # applies migrations + seed.sql
pnpm supabase gen types typescript --local > types/database.ts
pnpm dev
```

Seed data: 3 users (Hakim as admin), `#general`, `#random`, `#design`, ~200 messages with threads and reactions so the UI can be judged with realistic density.

For huddles locally, use a LiveKit Cloud dev project (free tier) — do not self-host LiveKit in Docker for now.

---

## 10. Definition of done for Phase 1

The whole Potara team has used Commune instead of Slack for text chat for one full working week without needing to open Slack for anything except huddles. Until that is true, Phase 1 is not done.

---

## 11. Desktop app (Mac and Windows)

`desktop/` is an Electron shell around the hosted site, decided on 2026-09-11. It is its own package with its own lockfile; the web workspace's lint and typecheck exclude it.

Rules:
- **The shell never bundles the app.** It loads `commune.potarastudio.com` (or `localhost:3001` with `COMMUNE_DEV=1`). Anything the app does, it does on the site.
- **The web app must keep working in a plain browser.** Desktop-only behaviour is gated on `isDesktopApp()` from `lib/desktop.ts`, which is the only place the page touches `window.communeDesktop`. Today that is: system notifications in place of push, following a notification click, and the Settings copy for it.
- **Sign-in goes through the system browser.** Google refuses embedded browsers. `/desktop/handoff` parks the refresh token under a one-shot id in `desktop_handoffs` (service-role only, two-minute expiry) and opens `commune://auth?handoff=<id>`; `/api/desktop/session` claims it. Never put a token in the deep link.
- **Verify with `pnpm smoke` in `desktop/`** against the dev server before shipping the shell; it covers sign-in, badge, notifications, screen share, close-to-hide and external links. Packaged builds: `pnpm dist:mac`, `pnpm dist:win`, `pnpm release` (see `desktop/README.md`).

Mobile remains a non-goal.

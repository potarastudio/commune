# Commune

Slack-style team chat for Potara Studio. **[CLAUDE.md](./CLAUDE.md) is the source of truth** for scope, stack, data model and conventions. Read it first.

## Status

Phase 1 feature-complete as of 2026-09-09: channels, DMs, threads, reactions, files, search, mentions, activity, settings, presence and typing. Now in team-trial hardening (§10).

## Local development

With Docker (the intended path, §9):

```bash
pnpm install
pnpm supabase start
pnpm db:reset          # migrations + seed
pnpm db:types          # regenerate types/database.ts
pnpm dev
```

Copy `.env.example` to `.env.local` and fill it from `pnpm supabase status`. Put the Google OAuth client id/secret in `supabase/.env` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`.

Before you seed, set `v_founder_email` at the top of `supabase/seed.sql` to the Google account you sign in with. The seeded admin account (Hakim) is linked to that identity on first sign-in.

### Without Docker

A plain local Postgres can validate the schema and run the RLS suite. Scripts under `scripts/` shim the `auth`/`storage` schemas Supabase normally provides:

```bash
pnpm db:reset:local    # drop + recreate commune_dev, apply shim, migrations, seed
pnpm test:rls          # supabase/tests/rls.sql via a tiny pgTAP shim
pnpm db:types:local    # types/database.ts via postgres-meta, no Docker
```

Never point these at a real Supabase project.

## Hosted project

Linked to Supabase project `lbxytfatdrhqcfvepzhb` (`commune`, ap-southeast-1). The CLI's login role lets `pnpm supabase db push` and `pnpm supabase db query --linked` run without the database password.

```bash
pnpm supabase db push          # apply new migrations to the hosted project
pnpm supabase migration list   # compare local vs remote
```

The hosted database is not seeded with the fake team; only the allowlist is populated by hand.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test
```

RLS suite (pgTAP, needs the local stack):

```bash
pnpm supabase test db
```

Playwright smoke (§8): signs in through the local-only `/auth/dev-login` route, sends in `#general`, sees it in a second context, reacts, replies in a thread. Needs the local stack and the dev server on 3001 (started automatically if not running).

```bash
pnpm test:e2e
```

## Schema notes

- Migrations live in `supabase/migrations/` and are the only way the schema changes.
- `insert_message()` is the write path for messages: it validates membership, derives `content_text` if the caller omits it, extracts mentions from the Tiptap JSON, links attachments, and optionally copies a thread reply into its channel.
- `get_or_create_conversation()` dedupes DMs by member set; `get_unread_counts()` powers sidebar badges; `search_messages()` backs the search page.
- The first account to sign in becomes admin; later accounts are members.

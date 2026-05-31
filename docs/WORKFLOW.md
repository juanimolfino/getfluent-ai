# Fluent Setup Workflow

This folder is the handoff area for setup notes, manual dashboard actions, and SQL that cannot or should not be run automatically.

## Working Rule

- Codex runs local commands, migrations, checks, and safe service setup when credentials are available in `.env.local`.
- Manual steps that require a web dashboard are documented here with exact instructions.
- SQL that must be pasted into Supabase should be added as a `.sql` file in this folder or referenced from `lib/db/`.
- Secrets never go in this folder. Keep them only in `.env.local` or provider dashboards.

## Current Setup Order

1. Configure Supabase credentials in `.env.local`. Done.
2. Run Drizzle migrations against Supabase Postgres. Done.
3. Apply Supabase RLS policies. Done.
4. Configure Supabase Auth URLs for local and production. Done.
5. Configure Google OAuth provider in Supabase and Google Cloud. Done.
6. Verify login callback creates the internal user profile. Pending manual login.
7. Continue Fluent-specific schema and app implementation. Pending.

## Verification Log

- 2026-05-31: Supabase anon client, service role API, Postgres `DATABASE_URL`, Resend API key, and Resend sender were verified from `.env.local`.
- 2026-05-31: Base Drizzle migrations were applied successfully.
- 2026-05-31: Base RLS policies were applied successfully.
- 2026-05-31: `npm run test` passed: 3 files, 10 tests.
- 2026-05-31: `npm run build` passed.
- 2026-05-31: Local `/login` returned HTTP 200.
- 2026-05-31: Local `/login/google` returned HTTP 307 to Supabase Google OAuth with callback `http://localhost:3000/callback`.
- 2026-05-31: Stripe test keys and Price IDs were verified. Test Checkout Sessions were created for a one-time pack and monthly subscription.

## Pending Credentials

These are not required for basic auth verification but are needed for later product features:

- `ANTHROPIC_API_KEY` for Fluent conversation AI.
- `ELEVENLABS_API_KEY` for Fluent voice output.
- Inngest and Upstash variables if background jobs and concurrency from the base remain enabled.

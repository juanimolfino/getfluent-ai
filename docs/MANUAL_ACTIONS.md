# Manual Actions

Use this file for steps that must be completed in external dashboards.

## Supabase Auth URLs

Configure these in Supabase Dashboard > Authentication > URL Configuration.

Production:

```text
Site URL:
https://getfluent-ai.vercel.app

Redirect URLs:
https://getfluent-ai.vercel.app/**
https://getfluent-ai.vercel.app/callback
```

Local development:

```text
Site URL:
https://getfluent-ai.vercel.app

Redirect URLs:
http://localhost:3000/**
http://localhost:3000/callback
```

Keep both production and local redirect URLs in the Supabase allow list when using the same Supabase project for local development and Vercel.

## Google OAuth

Configure this in Supabase Dashboard > Authentication > Providers > Google.

1. Enable Google.
2. Copy Supabase's callback URL, usually:

```text
https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback
```

3. Add that URL in Google Cloud Console as an authorized redirect URI for the Web OAuth client.
4. Paste the Google Client ID and Client Secret into Supabase.

## Vercel Production Environment Variables

Configure these in Vercel Dashboard > getfluent-ai > Settings > Environment Variables.

Minimum required for production login:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=https://getfluent-ai.vercel.app
FREE_SIGNUP_CREDITS=5
```

Recommended for email:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Required later for Fluent conversation:

```text
ANTHROPIC_API_KEY
ELEVENLABS_API_KEY
```

After adding or changing any `NEXT_PUBLIC_*` variable, redeploy production. Next.js inlines public environment variables into the browser bundle at build time.

## Supabase SQL

Status: base RLS was applied automatically on 2026-05-31.

If RLS needs to be reapplied in a fresh database and Codex cannot apply it automatically, run this file in Supabase SQL Editor:

```text
lib/db/rls.sql
```

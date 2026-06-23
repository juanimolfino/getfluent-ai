# Manual Actions

Use this file for steps that must be completed in external dashboards.

## Supabase Auth URLs

Configure these in Supabase Dashboard > Authentication > URL Configuration.

Production:

```text
Site URL:
https://www.aigetfluent.com

Redirect URLs:
https://aigetfluent.com/**
https://aigetfluent.com/callback
https://www.aigetfluent.com/**
https://www.aigetfluent.com/callback
```

Local development:

```text
Site URL:
https://www.aigetfluent.com

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
NEXT_PUBLIC_APP_URL=https://www.aigetfluent.com
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

Required for Stripe billing in production:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_ID_STARTER_MONTHLY
STRIPE_PRICE_ID_PLUS_MONTHLY
STRIPE_PRICE_ID_PRO_MONTHLY
STRIPE_PRICE_ID_PACK_MINI
STRIPE_PRICE_ID_PACK_MEDIO
STRIPE_PRICE_ID_PACK_BIG
```

Required for premium Deepgram voice input:

```text
DEEPGRAM_API_KEY
DEEPGRAM_TEMP_TOKEN_TTL_SECONDS=30
DEEPGRAM_FLUX_MODEL=flux-general-en
DEEPGRAM_FLUX_EOT_THRESHOLD=0.9
DEEPGRAM_FLUX_EOT_TIMEOUT_MS=10000
NEXT_PUBLIC_PREMIUM_STT_PROVIDER=browser
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
DEEPGRAM_TOKEN_GRANT_RATE_LIMIT_WINDOW_SECONDS=60
DEEPGRAM_TOKEN_GRANTS_PER_USER_PER_WINDOW=12
DEEPGRAM_TOKEN_GRANTS_PER_SESSION_PER_WINDOW=8
STT_METRICS_RATE_LIMIT_WINDOW_SECONDS=60
STT_METRICS_PER_USER_PER_WINDOW=60
```

Upstash Redis is required in production. If it is missing, expensive Fluent endpoints fail closed with `503` instead of running without rate limits.

Optional Fluent API rate-limit overrides:

```text
CONVERSATION_TURNS_PER_USER_PER_WINDOW=5
CONVERSATION_RATE_LIMIT_WINDOW_SECONDS=60
CONVERSATION_ANALYSES_PER_USER_PER_WINDOW=4
CONVERSATION_ANALYSIS_RATE_LIMIT_WINDOW_SECONDS=60
EXERCISE_GENERATIONS_PER_USER_PER_WINDOW=4
EXERCISE_GENERATION_RATE_LIMIT_WINDOW_SECONDS=60
EXERCISE_SPEECH_CHECKS_PER_USER_PER_WINDOW=20
EXERCISE_SPEECH_CHECK_RATE_LIMIT_WINDOW_SECONDS=60
EXERCISE_TTS_REQUESTS_PER_USER_PER_WINDOW=10
EXERCISE_TTS_RATE_LIMIT_WINDOW_SECONDS=60
TRANSLATION_REQUESTS_PER_USER_PER_WINDOW=10
TRANSLATION_RATE_LIMIT_WINDOW_SECONDS=60
PREMIUM_TTS_MONTHLY_CHARACTER_LIMIT=100000
PREMIUM_STT_MONTHLY_AUDIO_MS_LIMIT=18000000
MONTHLY_CONVERSATION_TURNS_PER_USER=600
MONTHLY_CONVERSATION_ANALYSES_PER_USER=60
MONTHLY_EXERCISE_GENERATIONS_PER_USER=120
MONTHLY_EXERCISE_SPEECH_CHECKS_PER_USER=300
MONTHLY_TRANSLATION_REQUESTS_PER_USER=300
MONTHLY_EXERCISE_TTS_REQUESTS_PER_USER=250
```

These overrides do not need to be set if the defaults are acceptable.

Use `NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux` to enable Deepgram for premium users. Roll back by setting it to `browser` and redeploying.

After adding or changing any `NEXT_PUBLIC_*` variable, redeploy production. Next.js inlines public environment variables into the browser bundle at build time.

## Supabase SQL

Status: base RLS was applied automatically on 2026-05-31.

If RLS needs to be reapplied in a fresh database and Codex cannot apply it automatically, run this file in Supabase SQL Editor:

```text
lib/db/rls.sql
```

Deepgram STT usage metrics require the latest Drizzle migration:

```text
npm run db:migrate
```

This adds `conversation_sessions.stt_audio_ms_used`.

## Stripe TEST MODE Setup

Create these Stripe Products/Prices in TEST MODE. The app reads credit counts from Price metadata, not from code.

| Product | Price | Price metadata | Env var |
| --- | --- | --- | --- |
| Fluent Starter | `$8.90 / month` | `credits=15`, `type=subscription` | `STRIPE_PRICE_ID_STARTER_MONTHLY` |
| Fluent Plus | `$14.90 / month` | `credits=25`, `type=subscription` | `STRIPE_PRICE_ID_PLUS_MONTHLY` |
| Fluent Pro | `$24.90 / month` | `credits=40`, `type=subscription` | `STRIPE_PRICE_ID_PRO_MONTHLY` |
| Pack Mini | `$4.90 one-time` | `credits=5`, `type=pack` | `STRIPE_PRICE_ID_PACK_MINI` |
| Pack Medio | `$8.90 one-time` | `credits=10`, `type=pack` | `STRIPE_PRICE_ID_PACK_MEDIO` |
| Pack Grande | `$16.90 one-time` | `credits=20`, `type=pack` | `STRIPE_PRICE_ID_PACK_BIG` |

Local webhook:

```text
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

Webhook events needed:

```text
checkout.session.completed
invoice.paid
customer.subscription.deleted
```

Production webhook endpoint:

```text
https://www.aigetfluent.com/api/stripe/webhook
```

Stripe Billing Portal:

- Configure manually in Stripe Dashboard > Billing > Customer portal.
- The app opens it through `POST /api/stripe/portal`.
- The portal endpoint requires an authenticated app user with a saved `users.stripeCustomerId`.
- The return URL is `${NEXT_PUBLIC_APP_URL}/dashboard`, currently `https://www.aigetfluent.com/dashboard`.
- If Stripe Customer Portal is not configured, Stripe rejects session creation and the app returns a clear configuration error.

Credit behavior:

- Pack purchase: adds metadata credits to `credits_pack`.
- Subscription invoice paid: resets `credits_subscription` to metadata credits. It does not add to previous subscription credits.
- Webhook idempotency uses Stripe `event.id` stored as `transactions.stripe_event_id`.

## Conversation Audio Retention Decision

Do not persist per-turn ElevenLabs conversation audio yet.

Reason: Supabase Storage does not currently have an app-level 60-day cleanup job in this repo. Persisting every conversation audio file before cleanup exists would create unbounded storage growth.

Future implementation requirement before enabling persisted conversation audio:

- Store only Alex audio, never raw user audio.
- Store objects under a scoped prefix such as `fluent/conversation-audio/{userId}/{sessionId}/...`.
- Add a daily authenticated cleanup endpoint or scheduled job that deletes objects older than 60 days.
- Only then save `audioUrl`/`audioPath` on assistant turns.

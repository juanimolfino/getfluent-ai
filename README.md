# AI SaaS Boilerplate

Production-oriented starter for launching AI micro-SaaS products with Next.js App Router, Supabase Auth/Postgres/Storage, Drizzle, Upstash Redis, Inngest, Stripe, Resend, fal.ai, and OpenAI TTS.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env vars:

```bash
cp .env.example .env.local
```

3. Create the Supabase project, private storage bucket `ai-results`, Stripe products/prices, Upstash Redis database, Inngest app, Resend API key, fal.ai key, and OpenAI API key. Use fresh credentials per product; never reuse the template project's secrets.

4. Run database migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Apply [lib/db/rls.sql](./lib/db/rls.sql) in the Supabase SQL editor.

6. Start the app and Inngest dev server:

```bash
npm run dev
npm run inngest
```

## AI Provider Pattern

Each provider implements `AiProvider` from [lib/ai/types.ts](./lib/ai/types.ts). Add a new provider in `lib/ai/providers`, register it in [lib/ai/providers/index.ts](./lib/ai/providers/index.ts), add a job type to the Drizzle enum, and extend [lib/ai/validation.ts](./lib/ai/validation.ts).

The reusable pipeline is:

`POST /api/jobs/create` validates auth and input, reserves a Redis concurrency slot, debits credits atomically, stores a pending job, sends `ai/job.created` to Inngest, and returns `{ jobId }`. The worker generates the result, uploads it to Supabase Storage, marks the job done, or refunds credits on failure.

## Stripe Plans and Prices

Credit pack and plan identifiers live in [lib/stripe/pricing.ts](./lib/stripe/pricing.ts). Credit amounts and product type must live in Stripe Price metadata, not in app code. Create matching Stripe Prices and put their IDs in `.env.local`:

```bash
STRIPE_PRICE_ID_STARTER_MONTHLY=
STRIPE_PRICE_ID_PLUS_MONTHLY=
STRIPE_PRICE_ID_PRO_MONTHLY=
STRIPE_PRICE_ID_PACK_MINI=
STRIPE_PRICE_ID_PACK_MEDIO=
STRIPE_PRICE_ID_PACK_BIG=
```

Each Stripe Price needs metadata `credits=<number>` and `type=subscription` or `type=pack`.

Recommended TEST MODE setup:

| Product | Price | Metadata |
| --- | --- | --- |
| Fluent Starter | `$8.90 / month` | `credits=15`, `type=subscription` |
| Fluent Plus | `$14.90 / month` | `credits=25`, `type=subscription` |
| Fluent Pro | `$24.90 / month` | `credits=40`, `type=subscription` |
| Pack Mini | `$4.90 one-time` | `credits=5`, `type=pack` |
| Pack Medio | `$8.90 one-time` | `credits=10`, `type=pack` |
| Pack Grande | `$16.90 one-time` | `credits=20`, `type=pack` |

Local webhook with Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

Webhook endpoint:

```text
/api/stripe/webhook
```

Handled events are `checkout.session.completed`, `invoice.paid`, and `customer.subscription.deleted`.

Webhook credit grants are idempotent by `stripeEventId`, so replayed Stripe events do not increment balances twice.

Subscription credits reset monthly through `invoice.paid`: `credits_subscription` is set to the plan metadata value and old subscription credits are lost. Pack credits are added to `credits_pack` and do not expire.

## Conversation Audio Storage

Do not persist per-turn ElevenLabs conversation audio yet. Current replay keeps generated audio in browser memory during the live session only. Persisting conversation audio should wait until there is an automated retention job that deletes Supabase Storage objects older than 60 days. This avoids unbounded storage growth and keeps the privacy posture simple. Exercise/example audio may still use short-lived browser cache; common phrase cache is separate.

## Security Defaults

- Generated files should live in a private Supabase Storage bucket. The app stores object paths and serves authenticated, short-lived signed URLs through `/api/jobs/result/[id]`.
- `/api/health` is protected in production with `HEALTHCHECK_SECRET`; call it with `Authorization: Bearer <secret>`.
- Upstash Redis is required in production for expensive API rate limits. If `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` is missing in production, expensive endpoints fail closed with `503`.
- Default rate limits are enforced per user: conversation `5/min`, analysis `4/min`, exercise generation `4/min`, speech checks `20/min`, exercise TTS `10/min`, and premium TTS monthly characters `100000`. Env overrides are documented in `.env.example`.
- Full security reference: [docs/SECURITY.md](./docs/SECURITY.md).
- Public auth/session debug endpoints are not part of the template.
- Credit debits, purchases, subscription grants, and refunds are recorded in `transactions`.
- Rotate every secret before creating a new product from this repo.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import it in Vercel.
3. Add every variable from [.env.example](./.env.example).
4. Configure Supabase auth redirect URLs for your Vercel domain.
5. Configure Stripe webhook signing secret for `https://your-domain.com/api/stripe/webhook`.
6. Set `HEALTHCHECK_SECRET` in production if you want to use `/api/health`.
7. Deploy.

## Main Routes

- `/` marketing landing page with metadata, sitemap, robots, and JSON-LD.
- `/pricing` public pricing page.
- `/login` Supabase magic link and Google OAuth.
- `/dashboard` protected user dashboard.
- `/api/jobs/create` async job creation.
- `/api/jobs/result/[id]` authenticated signed result URL redirect.
- `/api/jobs/status/[id]` job polling endpoint.
- `/api/inngest` Inngest function endpoint.

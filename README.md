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

Credit pack and plan metadata live in [lib/stripe/pricing.ts](./lib/stripe/pricing.ts). Create matching Stripe Prices and put their IDs in `.env.local`:

```bash
STRIPE_PRICE_ID_CREDITS_10=
STRIPE_PRICE_ID_CREDITS_50=
STRIPE_PRICE_ID_PRO_MONTHLY=
```

Webhook endpoint:

```text
/api/stripe/webhook
```

Handled events are `checkout.session.completed`, `invoice.paid`, and `customer.subscription.deleted`.

Webhook credit grants are idempotent by `stripeEventId`, so replayed Stripe events do not increment balances twice.

## Security Defaults

- Generated files should live in a private Supabase Storage bucket. The app stores object paths and serves authenticated, short-lived signed URLs through `/api/jobs/result/[id]`.
- `/api/health` is protected in production with `HEALTHCHECK_SECRET`; call it with `Authorization: Bearer <secret>`.
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

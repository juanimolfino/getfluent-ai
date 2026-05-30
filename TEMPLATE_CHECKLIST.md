# Template Setup Checklist

Use this before the first product-specific development prompt.

## GitHub

- [ ] Rename the base repository to `ai-saas-base`.
- [ ] Enable **Template repository** in the base repository settings.
- [ ] Create the product repository from the template, for example `headshots-ai`.
- [ ] Keep the product repository private until launch.
- [ ] Clone the product repository locally and open it in your editor.

## Product Scope

- [ ] Write the product name, target user, core AI output, and first paid offer.
- [ ] Decide which existing job types stay enabled: `image`, `tts`, or both.
- [ ] Decide whether the product needs a new provider, model, output type, or UI flow.
- [ ] Decide final credit costs per generation before creating Stripe products.

## Supabase

- [ ] Create a new Supabase project for the product.
- [ ] Copy the Project URL, anon key, and service role key.
- [ ] Create a private Storage bucket named `ai-results`, or set a custom `SUPABASE_STORAGE_BUCKET`.
- [ ] Configure Auth redirect URLs for local development and the Vercel domain.
- [ ] Enable Google OAuth if the product uses Google login.

## Stripe

- [ ] Create product-specific Stripe products and prices.
- [ ] Save every Stripe Price ID needed by `lib/stripe/pricing.ts`.
- [ ] Copy the Stripe secret key for the product environment.
- [ ] Create the webhook endpoint at `https://your-domain.com/api/stripe/webhook`.
- [ ] Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] Keep visible prices in `lib/stripe/pricing.ts` synchronized with Stripe.

## Environment Variables

- [ ] Copy `.env.example` to `.env.local`.
- [ ] Fill every required variable.
- [ ] Verify no variable is empty, especially `NEXT_PUBLIC_*`.
- [ ] Use fresh Supabase and Stripe credentials for every product.
- [ ] Reuse FAL, OpenAI, Upstash, Resend, or Inngest only if shared usage, quotas, logs, and billing are intentional.
- [ ] Rotate any credential that was pasted into chat, committed by mistake, or exposed during setup.

## Database

- [ ] Run `npm install`.
- [ ] Run `npm run db:generate` if the product changed the schema.
- [ ] Run `npm run db:migrate`.
- [ ] Apply `lib/db/rls.sql` in the Supabase SQL Editor.
- [ ] Confirm the `transactions` enum includes `credit_spend`.

## Local Verification

- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `node scripts/check-integrations.mjs`.
- [ ] Run `npm run dev`.
- [ ] Test magic link login.
- [ ] Test Google OAuth if enabled.
- [ ] Confirm first login creates a profile, free subscription, signup credits, and a `signup_bonus` transaction.
- [ ] Create a test job and confirm credit debit, async processing, private Storage upload, signed result URL, and dashboard preview.
- [ ] Force or observe a failed job and confirm credits are refunded once.

## Vercel

- [ ] Import the product repository into Vercel.
- [ ] Add every variable from `.env.example`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the production URL.
- [ ] Set `HEALTHCHECK_SECRET` for production health checks.
- [ ] Deploy production.
- [ ] Confirm `/`, `/pricing`, `/login`, and `/dashboard` respond as expected.
- [ ] Confirm `/api/health` returns 401 without the bearer token and healthy JSON with it.

## Product Context

- [ ] Generate or update `CONTEXT.md` after setup and verification.
- [ ] Commit `CONTEXT.md` to the product repository.
- [ ] Add product-specific README notes for providers, pricing, and deployment.

When this checklist is complete, the product repository is ready for feature development.

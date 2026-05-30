# Base Maintenance Strategy

This repository is the reusable starting point for AI SaaS products. Product repositories are created from this base as GitHub template copies.

## Local Workspace Layout

Keep the base and products as sibling folders:

```text
Desktop/
  ai-saas-base/
  headshots-ai/
  product-two/
  product-three/
```

Recommended daily workflow:

- Open the product repository in its own editor window.
- Keep the base repository closed unless improving the reusable foundation.
- Use a multi-root workspace only when comparing the base and a product side by side.
- Before editing, confirm the current folder and Git remote.

## Current Update Model

Template-created repositories are copies. Changes made later in `ai-saas-base` do not automatically affect existing product repositories.

For now, use a manual update model:

1. Improve `ai-saas-base`.
2. Document the change in this file or the base changelog.
3. Tag meaningful stable points, for example `v0.1.0-template`.
4. Port the change intentionally into each product that needs it.
5. Verify each product independently after porting.

This is intentionally simple. Early products will diverge, and manual porting avoids introducing shared abstractions before the repeated needs are clear.

## What Belongs In The Base

Good base changes:

- Security fixes.
- Billing, credit, and webhook correctness improvements.
- Auth/session fixes.
- Async job pipeline improvements that every product benefits from.
- Storage privacy and signed URL improvements.
- Deployment, env, and setup documentation.
- Reusable tests around credits, billing, auth, jobs, and storage.

Avoid putting product-specific logic in the base:

- Product names and branding.
- Product-specific landing copy.
- Product-specific provider prompts.
- Product-only UI flows.
- Product-only pricing.
- One-off admin or analytics decisions.

## Porting Base Changes Into Products

Use the smallest practical method:

- Small fixes: copy the patch manually or cherry-pick the commit.
- Medium shared changes: compare the base and product diff, then port files intentionally.
- Risky changes: create a branch in the product, run `npm run test`, `npm run build`, and integration checks before merging.

Suggested commit message format in product repositories:

```text
Port base update: <short description>
```

Include the base commit or tag in the commit body when useful.

## Future Migration Path

If maintaining several products manually becomes expensive, migrate in stages.

### Stage 1: Manual Porting

Use this now.

Best when:

- There are fewer than 3-5 active products.
- Products are changing quickly.
- Shared needs are still unclear.

Tradeoff:

- Simple and flexible, but repeated fixes must be ported manually.

### Stage 2: Base As Upstream Remote

Add `ai-saas-base` as an extra Git remote in each product and pull selected changes.

Example:

```bash
git remote add base https://github.com/juanimolfino/ai-saas-base.git
git fetch base
git cherry-pick <base-commit-sha>
```

Best when:

- Multiple products need the same base updates.
- The base and products still have similar file structure.
- We want traceable shared changes without extracting packages yet.

Tradeoff:

- More disciplined than manual copying, but conflicts are likely as products diverge.

### Stage 3: Shared Packages Or Monorepo

Extract stable common code into packages, for example:

- `@juanimolfino/ai-saas-auth`
- `@juanimolfino/ai-saas-billing`
- `@juanimolfino/ai-saas-jobs`
- `@juanimolfino/ai-saas-storage`

Best when:

- The same modules are used unchanged across many products.
- Bugs must be fixed once and released everywhere.
- Shared code has stable APIs.

Tradeoff:

- Higher upfront maintenance cost.
- Requires versioning, release discipline, and migration work.

## Decision Rule

Stay with manual porting until at least three products repeatedly need the same base changes. Move to upstream remote when porting becomes frequent but the code still resembles the base. Move to shared packages only after the common modules have stabilized.


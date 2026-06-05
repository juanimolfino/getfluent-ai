# Handoff: GetFluent — Pricing

## Overview
The pricing screen of **GetFluent**, an app to practice spoken English in natural conversations with
an AI character named **Alex**. It presents two **plans** (Free / Pro) and three one-time **credit
packs** (Starter / Practice / Fluent). The whole page is built from **one reusable card component**
(`.pcard`) in two scales — plan cards and smaller pack cards — so the layout stays consistent and easy
to extend.

Visual direction: editorial / warm, with the Pro plan as an **inverted ink card** for emphasis
(inspired by the clean card system of Artificial Studio). Cream + ink, `Instrument Serif` prices,
pastel lilac/peach accents.

---

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a working prototype of the
look, layout, copy, and card system. They are **not meant to be shipped as-is**.

Your task: **recreate this screen in the target codebase** (React/Next, Vue, etc.) as a **reusable
card component** driven by data, wired to real checkout. Reuse the tokens and structure rather than
copying markup verbatim.

Files included:
- `app-pricing.html` — the full pricing page (structure, copy, page-specific CSS).
- `styles.css` — the **shared design system** (tokens, type, buttons, utilities). **Port this first**;
  shared across all GetFluent screens.

---

## Fidelity
**High-fidelity (hifi).** Final colors, type, spacing, hovers. Recreate pixel-faithfully.

---

## Tech / Dependencies
- **Fonts:** `Instrument Serif` (400/italic — prices & headings) + `Hanken Grotesk` (300–800), Google Fonts.
- **Icons:** inline stroke SVG (1.7–1.8) — check marks in lists, card icon on CTAs, shield on the
  guarantee strip. Swap for the project's set; keep thin/rounded.
- **No page-specific JS.** Pure layout + CSS hovers. Add checkout handlers on integration.
- Page **scrolls** normally.

---

## Layout
Sticky top bar + centered content (`max-width 1200px`, sections capped at `880px`).

### Top bar (`.topbar`)
Translucent cream, blur, 1px bottom border, 66px. Logo left; **"Back to practice"** ghost button right.

### Page head
Centered: eyebrow → big serif H1 *"Speak more. Pay less."* ("less." italic lilac) → 19px muted subhead.

### Plans (`.plans`)
2-col grid (`1fr / 1fr`), `max-width 880px`. Two `.pcard`s: **Free** and **Pro** (`.pcard.feature`).
Collapses to 1 col `< 760px`.

### Credit packs
A sub-head ("Or grab a credit pack") + `.packs` 3-col grid of smaller `.pcard.pack`s
(Starter / Practice / Fluent). Collapses to 1 col `< 760px`.

### Guarantee strip (`.guarantee`)
Centered faint row with a shield icon: "Cancel anytime · Credits never expire · No hidden fees".

---

## Components

### The reusable card (`.pcard`) — build this once, instance it everywhere
A flex-column card: white bg, 1px `--line` border, radius 28px, `32px` padding. Hover:
`translateY(-4px)` + shadow. Anatomy (all optional, data-driven):
- **`.pc-top`** — `.pc-name` (uppercase 15px label) and an optional **`.pc-tag`** badge (lilac pill,
  e.g. "Most popular").
- **`.pc-price`** — serif, 66px (48px in pack scale); a `<small>` renders the cadence ("/mo").
- **`.pc-desc`** — 15px muted one-liner (min-height reserved so cards align).
- **`.pc-list`** — feature list; each `<li>` = a check icon (mint-ink; lilac on the feature card) + text.
- **`.pc-cta`** — full-width button pinned to the card bottom (`margin-top: auto`).

**Variants:**
- **`.pcard.feature`** (the Pro plan): bg `--ink`, cream text, lilac checks, a blurred lilac **blob**
  in the top-right corner, and a white CTA. Use this to highlight the recommended plan.
- **`.pcard.pack`** (credit packs): smaller padding, 48px price, and a **`.pc-credits`** peach pill
  (e.g. "25 credits") at the top.

> Implement as a single `<PricingCard variant="default|feature|pack" … />` taking
> `{ name, tag?, price, cadence?, description, features[], credits?, ctaLabel, ctaHref|onBuy }`.

### Buttons
Shared `.btn` system: primary ink, `.btn-ghost`, `.btn-white` (used on the ink feature card). CTAs are
full-width + centered. The Free plan's CTA is a disabled "Current plan" state in the prototype.

### Logo
Shared gradient circle mark + "GetFluent" wordmark.

---

## Interactions & Behavior
- **Card hover lift** on all `.pcard`s.
- **CTAs:**
  - Free → "Current plan" (disabled if the user is on Free) or "Start free".
  - Pro → start subscription checkout.
  - Packs → one-time purchase checkout for that credit bundle.
  Wire each to the real billing provider (Stripe etc.); reflect the user's current plan to set the
  disabled/active state.
- **Guarantee strip** is static reassurance copy.
- **Responsive:** plans 2→1 col `< 760px`; packs 3→1 col `< 760px`.

## State Management
- **Current plan / entitlement** (Free vs Pro) to set CTA states.
- **Pricing data** ideally from config/CMS or the billing provider rather than hard-coded
  (`{ plans[], packs[] }` → fed into the `PricingCard` instances).
- **Checkout state** (redirecting / processing / error) per CTA.
- No other persistent state.

---

## Design Tokens
(From `styles.css` `:root` — port verbatim.)

**Surfaces** — `--paper #FBFAF6` · `--card #FFFFFF` (cards) · `--ink #211E1A` (feature card bg).
**Ink** — `--ink-2 #57524A` (list/desc text) · `--ink-3 #8C857A` (price `<small>`, guarantee) · borders `--line` / `--line-2`.
**Accents** — lilac `#E8DEF8` + lilac-ink `#6A4FA3` ("Most popular" tag, feature checks, feature blob) ·
mint-ink `#3C8868` (default check marks) · peach `#FBE2D2` + peach-ink `#BF6233` (pack credit pill).
**Radii** — cards 28px · pills/tags 100px. **Shadows** — `--shadow` on hover. **Motion** — `--ease cubic-bezier(.22,.61,.36,1)`.

**Type** — display `Instrument Serif` (H1 + prices); body `Hanken Grotesk`. H1 `44→68px`; plan price
66px; pack price 48px; list 15.5px.
**Layout** — content `max-width 1200px`; plans/packs capped at `880px`.

---

## Assets
- **No raster images / no external assets** — logo, check icons, card/shield icons are CSS + inline SVG.

## Copy
All copy lives in `app-pricing.html` — reuse verbatim (plan names, feature bullets, pack sizes,
guarantee line). **Prices ($0 / $9 / $5 / $12 / $28) and credit counts are placeholders** — confirm
real numbers with the product/billing setup before launch. English UI.

## Files
- `app-pricing.html` — full markup, copy, page-specific CSS.
- `styles.css` — shared design system (port/import first).

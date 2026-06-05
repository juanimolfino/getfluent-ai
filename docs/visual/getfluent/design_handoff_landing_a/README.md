# Handoff: GetFluent — Landing A (Editorial)

## Overview
Marketing landing page for **GetFluent**, an app to practice spoken English in natural
conversations with an AI character named **Alex**. This is the primary acquisition page —
it explains the product, how it works, who it's for, pricing, and drives sign-ups.

"Direction A" is the **editorial / safe** direction: a clean cream-and-ink layout with an
elegant serif display face, lots of whitespace, and pastel accents. Think Nikomade / Vercel
restraint with a warm, human tone.

---

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a working prototype
that shows the intended look, layout, copy, and micro-interactions. They are **not meant to be
shipped as-is**.

Your task: **recreate this landing in the target codebase** using its existing environment and
conventions (React/Next, Vue, Astro, plain HTML — whatever the project uses). If no codebase
exists yet, **Next.js + React + CSS Modules (or Tailwind)** is a good default for a marketing site.
Reuse the design tokens and component structure described below rather than copying markup verbatim.

Files included:
- `landing-a.html` — the full landing page (structure, copy, inline page-specific CSS, JS).
- `styles.css` — the **shared design system**: tokens, typography, buttons, cards, the Alex orb,
  utilities. This is the source of truth for the visual language. Port this first.

---

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions. Recreate
pixel-faithfully. Exact values are listed under **Design Tokens** below.

---

## Tech / Dependencies
- **Fonts (Google Fonts):** `Instrument Serif` (400 + 400 italic) for display headlines, and
  `Hanken Grotesk` (300–800) for UI/body. Load via `<link>` or self-host.
  ```
  https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@300;400;500;600;700;800&display=swap
  ```
- **No JS framework required.** The prototype uses ~30 lines of vanilla JS for: sticky-nav border
  on scroll, and IntersectionObserver fade-up reveals. Reimplement with the codebase's idioms
  (e.g. a `useScroll` hook + a `<Reveal>` wrapper, or CSS `animation-timeline: view()`).
- **Icons** are inline SVG (stroke-based, 1.7–1.8 stroke width). Swap for the project's icon set
  (lucide/heroicons match the style) — keep the thin, rounded look.

---

## Page Structure (top → bottom)
All sections are centered in a `max-width: 1200px` container with `32px` side padding.

1. **Sticky nav** — logo left, links center, "Log in" (ghost) + "Start free" (solid) right.
   Background is translucent cream with `backdrop-filter: blur(14px)`; a 1px bottom border
   fades in once `scrollY > 12`.
2. **Hero** — 2-col grid `1.05fr / .95fr`, gap `56px`, vertically centered.
   - Left: eyebrow → big serif H1 (`Talk your way to *fluent.*`, the word "fluent." in italic
     lilac) → 21px muted subhead → CTA row (solid "Start a free conversation" + ghost
     "See how it works") → tiny "No credit card" note with a pulsing dot.
   - Right: the **chat demo card** (see Components). Rotated `0.6deg`, big soft shadow.
   - Two blurred pastel **blobs** (lilac top-right, peach bottom) sit behind, `z-index: 0`.
3. **Trust row** — centered, faint 14px: star rating · conversations count · "Speaks A1 → C2".
   *(These numbers are placeholders — replace with real metrics or remove.)*
4. **How it works** (`#how`) — section header + 3 step cards (grid of 3). Each card has a giant
   serif number (01/02/03), a title, body, and a blurred pastel tint blob in the corner.
5. **Who it's for** (`#who`) — on a `--paper-2` background band. Header + 4 cards (Travelers,
   Interviews, Students, Professionals), each with a pastel icon tile. Cards lift on hover.
6. **Pricing** (`#pricing`) — header + 2 plans (Free / Pro). Pro card is inverted (ink bg, cream
   text) with a "Most popular" lilac badge.
7. **FAQ** (`#faq`) — on `--paper-2`. Centered header + `<details>` accordion (4 items, first open).
   Custom +/− toggle that morphs to − when open.
8. **Final CTA** — centered, large Alex orb, big serif headline (`...is *waiting.*`), CTA. Pastel
   blobs behind.
9. **Footer** — logo + tagline left, 3 link columns right, copyright line below.

---

## Components

### Logo
26px circular mark = a lilac→peach linear-gradient circle with a thin smile arc
(`stroke #3a2a55`, width 1.7), followed by the wordmark "GetFluent" at 19px / weight 600 /
`letter-spacing -0.02em`. Gap 11px.

### Buttons (`.btn`)
- Pill shape (`border-radius: 100px`), font-weight 600, gap 9px for icon.
- **Primary** (default): bg `--ink` (#211E1A), text `--paper` (#FBFAF6).
- **Ghost** (`.btn-ghost`): transparent bg, `--ink` text, `--line-2` (#D9D3C6) border; hover bg `--paper-2`.
- **White** (`.btn-white`): white bg, ink text, light border (used on dark surfaces).
- Sizes: base `13px 22px / 16px`; `.btn-lg` `16px 28px / 17px`; `.btn-sm` `9px 16px / 14px`.
- Hover: `translateY(-1px)` + soft shadow. Transition `.18s cubic-bezier(.22,.61,.36,1)`.

### Eyebrow (`.eyebrow`)
Uppercase 13px / weight 600 / `letter-spacing .08em`, color `--ink-2`, preceded by a 7px lilac dot.

### Chat demo card (`.demo`) — the hero centerpiece
- White card, `border-radius: 28px`, 1px `--line` border, large shadow `--shadow-lg`, `20px` padding.
- **Header:** 42px **Alex orb** + "Alex" (15px/600) + sub-line "Listening · B2 · Travel" with a
  green live dot. 1px bottom divider.
- **Body:** stacked bubbles, gap 12px, font 15px / line-height 1.45, padding `12px 16px`, radius 18px:
  - Alex bubble: bg `--paper-2`, bottom-left corner squared (`6px`). Includes a small "Play voice"
    affordance in lilac with a speaker icon.
  - User bubble: bg `--lilac` (#E8DEF8), ink text, right-aligned, bottom-right corner squared.
- **Bar:** 46px circular ink **mic button** (mic icon) + an animated equalizer (`.mic-eq`, bars
  pulsing height + turning lilac) + "Tap to send" label. 1px top divider.

### Alex orb (`.alex-orb`) — brand identity for the AI
A circle with a radial gradient `#F3E6FF → --lilac → --peach`, soft inner highlight + outer
lilac glow. Inside: 5 vertical bars (`.wave i`) animating height (`scaleY .45 → 1`) on staggered
delays — a voice waveform. Size set per use (36–88px). **Respect `prefers-reduced-motion`** (stop the animation).

### Step card (`.step`)
White card, 1px border, radius 18px, `28px` padding. Serif number 60px in faint ink (`opacity .5`),
title 21px, body 15.5px `--ink-2`. Corner blob: 120px blurred pastel circle (`opacity .5`).

### Audience card (`.aud`)
White card, radius 18px, `26px` padding. 46px rounded-13px **icon tile** in a pastel tint with the
matching pastel-ink color for the stroke icon. Title 18px, body 14.5px. Hover: `translateY(-4px)` + shadow.
Tints used: sky / lilac / peach / mint (one per card).

### Plan card (`.plan`)
Radius 28px, `34px` padding. Name (uppercase 15px), serif price (64px), per-line, check-list
(`gap 13px`, 19px mint-ink check icons), full-width CTA. **Pro variant** (`.plan.pro`): bg `--ink`,
cream text, lilac checks, absolute "Most popular" badge (lilac pill) top-right.

### FAQ item (`.qa`)
`<details>`/`<summary>`. Summary: 19px / weight 500, `24px 4px` padding, 1px bottom border.
Custom `.pm` toggle (26px) drawn from two 2px bars; the vertical bar fades out when `[open]`.
Answer: `--ink-2`, 16px, `max-width 64ch`.

---

## Interactions & Behavior
- **Sticky nav border:** add `.scrolled` (border-color → `--line`) when `window.scrollY > 12`.
- **Reveal on scroll:** elements `.step, .aud, .plan, .sec-head` start at `opacity 0; translateY(18px)`
  and transition to visible (`.7s` ease) when they enter the viewport (IntersectionObserver, threshold .12,
  unobserve after). Gate behind `prefers-reduced-motion: no-preference`.
- **Orb waveform + mic equalizer:** continuous CSS keyframe loops; pause under reduced-motion.
- **Live dots:** small pulsing box-shadow ring (`pulse` keyframe).
- **Hovers:** buttons lift 1px; audience cards lift 4px; nav links ink-darken.
- **Anchor nav:** in-page links (`#how`, `#who`, `#pricing`, `#faq`) — enable `scroll-behavior: smooth`.
- **CTAs link to** the app: "Start free" → practice setup; "Log in" → sign-in; "Upgrade to Pro" → pricing.
- **Responsive:** hero collapses to 1 col `< 920px`; steps/plans/audience to 1–2 cols `< 820–900px`;
  nav links hide `< 860px` (add a mobile menu in production).

## State Management
Essentially static marketing page — no app state. The only client state is ephemeral UI
(scrolled flag, reveal observers, `<details>` open). No data fetching. Trust-row metrics, if kept,
should come from a CMS/config rather than being hard-coded.

---

## Design Tokens
(From `styles.css` `:root`. Port verbatim.)

**Surfaces**
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FBFAF6` | page background, text-on-ink |
| `--paper-2` | `#F4F1EA` | alt section bands, Alex bubble |
| `--paper-3` | `#ECE8DF` | deeper cream |
| `--card` | `#FFFFFF` | cards |

**Ink / text**
| `--ink` | `#211E1A` | primary text, primary button |
| `--ink-2` | `#57524A` | secondary text |
| `--ink-3` | `#8C857A` | faint text |
| `--line` | `#E7E2D7` | borders |
| `--line-2` | `#D9D3C6` | stronger borders / inputs |

**Pastels (tint bg)** — lilac `#E8DEF8` · peach `#FBE2D2` · sky `#D8E7F4` · mint `#DCEDE2` · butter `#F8EBCB`

**Pastel inks (icon/text strength)** — lilac `#6A4FA3` · peach `#BF6233` · sky `#3A6896` · mint `#3C8868`

**Radii** — sm `12px` · base `18px` · lg `28px` · pill `100px`

**Shadows**
- `--shadow-sm`: `0 1px 2px rgba(33,30,26,.04), 0 1px 1px rgba(33,30,26,.03)`
- `--shadow`: `0 12px 30px -12px rgba(33,30,26,.14), 0 2px 6px rgba(33,30,26,.05)`
- `--shadow-lg`: `0 40px 80px -32px rgba(33,30,26,.28), 0 8px 24px -12px rgba(33,30,26,.12)`

**Motion easing** — `--ease: cubic-bezier(.22,.61,.36,1)`

**Type**
- Display: `Instrument Serif`, 400, `letter-spacing -0.01em`, `line-height 1.02`. Italic used for
  the emphasized word in each headline, usually colored `--lilac-ink`.
- Body/UI: `Hanken Grotesk`. Body 17px / `line-height 1.55` / `letter-spacing -0.005em`.
- Headline scale (clamp): H1 `52→88px`; section H2 `36→56px`; final CTA `44→80px`.

**Layout** — container `max-width 1200px`, side padding `32px`. Narrow variant `880px`.

---

## Assets
- **No raster images / no external assets.** All visuals are CSS + inline SVG.
- Alex's identity (the orb) and all icons are SVG drawn inline — reproduce as components.
- If you later add product screenshots/photos, the chat demo card is the natural slot.

## Copy
All final copy lives in `landing-a.html` — reuse verbatim. The voice is warm, direct, second-person,
slightly anti-"study" ("Made for people who'd rather talk than study"). Currently **English**; if the
product targets Spanish-speaking learners, a Spanish translation of the marketing copy may convert better
(the app copy itself stays English).

## Files
- `landing-a.html` — full page markup, copy, page-specific CSS (in `<style>`), and the vanilla JS.
- `styles.css` — shared design system (import/port this first; everything depends on it).

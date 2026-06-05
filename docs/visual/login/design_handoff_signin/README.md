# Handoff: GetFluent — Sign in (/login)

## Overview
Authentication screen for **GetFluent**, an app to practice spoken English in natural
conversations with an AI character named **Alex**. This is the `/login` (sign-in) page.

The brief: keep it **simple and minimal, but premium** — not empty. The solution is a
**two-column split**: a warm, branded pastel panel on the left (logo, Alex orb, a serif
promise, and a social-proof quote) and a clean, focused sign-in form on the right
(magic-link email + Google). Editorial / warm direction: cream + ink, `Instrument Serif`
display, pastel lilac/peach accents.

---

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a working prototype
that shows the intended look, layout, copy, and behavior. They are **not meant to be shipped as-is**.

Your task: **recreate this screen in the target codebase** using its existing environment and
conventions (React/Next, Vue, Astro, plain HTML — whatever the project uses). Wire the form to the
real auth provider. Reuse the design tokens and component structure described below rather than
copying markup verbatim.

Files included:
- `app-login.html` — the full sign-in page (structure, copy, inline page-specific CSS).
- `styles.css` — the **shared design system**: tokens, typography, buttons, the Alex orb,
  utilities. Source of truth for the visual language — **port this first**. It is shared across
  every GetFluent screen, so if you already ported it for another screen, reuse that.

---

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout. Recreate
pixel-faithfully. Exact values under **Design Tokens** below.

---

## Tech / Dependencies
- **Fonts (Google Fonts):** `Instrument Serif` (400 + 400 italic) for display, `Hanken Grotesk`
  (300–800) for UI/body.
  ```
  https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@300;400;500;600;700;800&display=swap
  ```
- **No JS framework required for the layout.** The prototype has no page-specific JS — all the
  work is the auth wiring you add (see State Management). 
- **Icons** are inline SVG (stroke 1.7–1.8). The Google "G" is a multicolor SVG. Swap for the
  project's icon set but keep the thin rounded look; keep the official Google mark for the Google button.
- **`100vh` full-bleed layout** — page does not scroll on desktop. On mobile the brand panel is
  hidden and the page scrolls normally.

---

## Layout
A CSS grid filling the viewport: `grid-template-columns: 1.05fr 1fr; height: 100vh;`

### Left — brand panel (`.brand-side`)
- Background is a layered warm wash: two radial-gradients (lilac from top-left, peach from
  bottom-right) over `--paper-2`. A subtle **dot grain** overlay (`radial-gradient` dots on a 22px
  grid, masked to fade at the edges) adds texture.
- `48px` padding, `flex-column`, `space-between` → three zones top/middle/bottom:
  - **Top:** logo (left) + "← Back home" link (right).
  - **Middle:** a 72px **Alex orb**, then a big serif headline
    *"Pick up right where you left off."* (the words "left off." in italic lilac).
  - **Bottom:** a **quote card** — serif 24px testimonial + an attribution row
    (38px gradient avatar circle + name/detail line).
- **Hidden below 860px** (`display: none`) — mobile shows only the form.

### Right — form panel (`.form-side`)
- Centered (`display: grid; place-items: center`), `--paper` background, `40px` padding.
- Form box `max-width: 380px`:
  - Serif headline *"Welcome back."* ("back." italic) at `40→52px`.
  - 17px muted description.
  - **Email field** → label + `.input`.
  - Full-width primary **"Send magic link"** button (envelope icon).
  - **"or"** divider (`.or`: text centered between two hairlines).
  - Full-width white **"Continue with Google"** button (multicolor G).
  - Legal line: 12.5px faint text with underlined Terms / Privacy links.

---

## Components

### Logo
26px circular mark = lilac→peach gradient circle + thin smile arc (`stroke #3a2a55`, width 1.7),
followed by wordmark "GetFluent" (19px / 600 / `letter-spacing -0.02em`). Gap 11px.

### Alex orb (`.alex-orb`) — brand identity for the AI
A circle with radial gradient `#F3E6FF → --lilac → --peach`, soft inner highlight + outer lilac
glow. Inside: 5 vertical bars animating height (`scaleY .45 → 1`) on staggered delays — a voice
waveform. Used here at 72px. **Respect `prefers-reduced-motion`** (stop the animation).

### Input (`.input`)
Full-width, 16px, padding `14px 16px`, 1px `--line-2` border, radius 13px, white bg.
Placeholder `--ink-3`. **Focus:** border → `--lilac-ink` + a 4px lilac focus ring
(`box-shadow: 0 0 0 4px` of ~60% lilac). Label above: 13px / weight 600 / `--ink-2`, 7px gap.

### Buttons (`.btn`)
Pill shape, weight 600, gap for icon. Variants used here:
- **Primary** (`.btn`, also `.btn-lg`): bg `--ink`, text `--paper` — the magic-link CTA.
- **White** (`.btn-white .btn-lg`): white bg, ink text, light border — the Google button.
- `.btn-full` makes a button stretch to 100% and center its content.
- Hover: `translateY(-1px)` + soft shadow.

### Divider (`.or`)
Flex row: hairline — "or" (13px, `--ink-3`) — hairline. `22px` vertical margin.

### Quote card (`.quote`)
Serif 24px line (`line-height 1.25`), then `.by` row: 38px avatar circle
(`linear-gradient(135deg, --sky, --mint)`) + 14px `--ink-2` caption. *(Placeholder testimonial —
replace with a real one or remove.)*

---

## Interactions & Behavior
- **Focus states** are the key affordance — lilac ring on the email input (see above). Apply the
  same ring to buttons for keyboard focus in production.
- **Orb waveform:** continuous CSS keyframe loop; pause under reduced-motion.
- **Hovers:** primary/white buttons lift 1px + shadow; "Back home" and legal links ink-darken.
- **Responsive:** `< 860px` the brand panel is hidden, the grid collapses to one column, and
  `body` overflow returns to `auto` (page scrolls). Keep the form comfortably padded on mobile.
- **No client-side validation shown** — add inline email validation + error/success states in production.

## State Management
This screen is **the UI shell for auth** — wire it to the project's real provider:
- **Magic link:** on submit, POST the email to your passwordless endpoint (e.g. Supabase
  `signInWithOtp`, Auth.js Email provider, Clerk, etc). Show states: idle → submitting (disable
  button / spinner) → "Check your inbox" success → error. The current markup has the input + button
  only; add those states.
- **Google:** trigger the OAuth flow (`signIn('google')` or provider equivalent).
- On success, redirect to the practice setup screen.
- The form uses `onsubmit="return false"` purely to keep the prototype inert — replace with a real handler.
- No other persistent state on this page.

---

## Design Tokens
(From `styles.css` `:root`. Port verbatim. Subset relevant to this screen.)

**Surfaces** — `--paper #FBFAF6` (form bg) · `--paper-2 #F4F1EA` (brand panel base) ·
`--card #FFFFFF` (inputs).

**Ink / text** — `--ink #211E1A` · `--ink-2 #57524A` · `--ink-3 #8C857A` ·
borders `--line #E7E2D7` / `--line-2 #D9D3C6` (inputs).

**Pastels** — lilac `#E8DEF8` · peach `#FBE2D2` · sky `#D8E7F4` · mint `#DCEDE2`.
**Pastel inks** — lilac-ink `#6A4FA3` (focus ring / italic accent) · sky/mint used in the avatar gradient.

**Radii** — input `13px` · base `18px` · pill `100px`.

**Shadows** — `--shadow-sm`, `--shadow` (button hover). See styles.css for exact values.

**Motion** — `--ease: cubic-bezier(.22,.61,.36,1)`.

**Type**
- Display: `Instrument Serif` 400, italic for the emphasized word (colored `--lilac-ink`).
  "Welcome back." `40→52px`; brand headline `40→60px`; quote 24px.
- Body/UI: `Hanken Grotesk`. Description 17px; labels 13px/600; legal 12.5px.

**Layout** — full-viewport grid `1.05fr / 1fr`; form box `max-width 380px`; brand panel padding `48px`.

---

## Assets
- **No raster images / no external assets.** Logo, Alex orb, icons, and the avatar are all CSS +
  inline SVG. Keep the official multicolor Google "G" for the Google button.
- The 38px quote avatar is a gradient placeholder — swap for a real photo if you keep the testimonial.

## Copy
All final copy lives in `app-login.html` — reuse verbatim. Warm, second-person, low-friction.
Currently **English**. (App copy stays English even if marketing is localized.)

## Files
- `app-login.html` — full markup, copy, page-specific CSS (in `<style>`).
- `styles.css` — shared design system (port/import first; everything depends on it).

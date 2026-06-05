# Handoff: GetFluent — Dashboard (/dashboard)

## Overview
The signed-in home screen of **GetFluent**, an app to practice spoken English in natural
conversations with an AI character named **Alex**. After login the user lands here. It's a calm,
premium overview: a greeting, key account stats, a primary "practice with Alex" entry point, quick
re-entry chips, and a list of recent conversations.

The brief: the current dashboard is plain and will grow over time — keep it **fresh, minimal,
premium**, in the same editorial / warm system as the rest of the app, and leave room to expand.
Cream + ink, `Instrument Serif` display, pastel lilac/peach/sky accents.

> **Product note:** the legacy version had "Legacy AI job tools" and "Generated job history"
> sections — these are leftovers from a previous product and were intentionally **removed**. The
> natural dashboard content for GetFluent is *recent conversations*. If job tools must stay, add them
> back as a collapsible secondary section.

---

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a working prototype of the
look, layout, copy, and behavior. They are **not meant to be shipped as-is**.

Your task: **recreate this screen in the target codebase** (React/Next, Vue, etc.), wired to real
account data. Reuse the tokens and component structure rather than copying markup verbatim.

Files included:
- `app-dashboard.html` — the full dashboard (structure, copy, page-specific CSS).
- `styles.css` — the **shared design system** (tokens, type, buttons, Alex orb, utilities).
  **Port this first**; it's shared across all GetFluent screens — reuse your existing port.

---

## Fidelity
**High-fidelity (hifi).** Final colors, type, spacing, hovers. Recreate pixel-faithfully.

---

## Tech / Dependencies
- **Fonts:** `Instrument Serif` (400/italic — headings, stat values) + `Hanken Grotesk` (300–800),
  Google Fonts.
- **Icons:** inline stroke SVG (1.6–1.8). Swap for the project's set; keep thin/rounded.
- **No page-specific JS.** Pure layout + CSS hovers; everything is data-driven on integration.
- Page **scrolls** normally; sticky top bar.

---

## Layout
Sticky top bar + a centered content column (`max-width 1200px`, `32px` side padding).

### Top bar (`.topbar`)
Translucent cream, blur, 1px bottom border, 66px. Logo left; right side has lightweight
**icon links** (`.iconlink`, pill hover): "Buy credits", "Billing", "Log out". (Primary "Start
practicing" lives in the greeting, not here.)

### Greeting (`.greet`)
Flex row, `align-items: flex-end`, wraps. **Left column must be `flex: 1 1 420px; min-width: 0`**
(class `.gcol`) so the serif H1 gets full width and doesn't collapse/wrap into the email — this was a
real bug; keep the flex sizing. Contents: serif H1 "Welcome back, *Juani.*" (name italic lilac) +
an email row with a small gradient avatar. Right: primary **"Start practicing"** button (arrow).

### Stats strip (`.stats`)
4-col grid (`repeat(4,1fr)`), gap 16px → 2 cols `< 880px`, 1 col `< 480px`. Four `.stat` cards
(see component).

### Main grid (`.grid`)
`1.55fr / 1fr`, gap 16px → 1 col `< 900px`. Left = **practice hero**; right = **quick-start** card.

### Recent conversations
Section header (`.section-h`: serif title + "View all →" link) + `.sessions` grid
(`repeat(3,1fr)` → 2 → 1) of `.scard`s.

---

## Components

### Stat card (`.stat`)
White card, 1px border, radius 18px, `22px 24px` padding, blurred pastel corner tint (`.tint`,
optional). Anatomy: `.k` label (13px/600 + 16px icon), `.v` **serif value** (50px; a `<small>`
renders a unit like "days"/"sessions"), `.sub` faint caption. The Subscription card swaps the value
for a smaller "Pro" + a `.pillrow` with a mint **"Active"** live badge and renewal date.
Four instances: Credit balance · Subscription · Current streak · This week. Tints used:
lilac / (none) / peach / sky.

### Practice hero (`.practice`)
Feature card with a soft lilac→white diagonal gradient bg + a blurred peach corner blob. Inner flex:
copy (serif "Practice with *Alex*", a line of body, a CTA row with **"New conversation"** + a
"resume last session" link) and a **96px Alex orb** on the right. Stacks (orb on top) `< 560px`.

### Quick-start card (`.quick`)
White card. Heading "Jump back in" (bolt icon) + sub-line + `.qchips`: pill links to frequent topics,
each with a colored `.dot` (lilac/sky/peach/mint), plus a dashed-lilac **"✦ Surprise me"** chip
(random topic). Chips lift on hover.

### Session card (`.scard`)
White card, lifts on hover. Top row: a pastel **icon tile** (matched to the topic) + a status
**pill** — `.active` (mint) or `.done` (paper-2/faint). Then a title, a meta line
(level · turns · when), and a slim **progress bar** (`.barwrap` with a lilac→peach fill). Links to
that conversation.

### Alex orb / Logo
Shared components — lilac→peach gradient orb with animated 5-bar waveform (respect
`prefers-reduced-motion`); gradient circle mark + "GetFluent" wordmark.

### Empty state (`.empty`)
A dashed-border, centered, faint placeholder is included for first-time users (no sessions yet) —
use it in place of the sessions grid when the list is empty.

---

## Interactions & Behavior
- **Card hovers:** stat cards are static; session cards and quick chips lift (`translateY(-3px)` +
  shadow).
- **CTAs:** "Start practicing" / "New conversation" / quick chips → practice setup (chips can
  pre-seed the topic). "Resume …" → the active session in the chat. "View all" → full history.
  "Buy credits"/"Billing" → pricing/billing portal. "Log out" → sign out.
- **Orb waveform:** continuous CSS loop; pause under reduced-motion.
- **Responsive:** stats 4→2→1; main grid 2→1 `< 900px`; sessions 3→2→1; practice hero stacks `< 560px`.
  Keep the `.gcol { flex:1 1 420px; min-width:0 }` rule so the greeting never collapses.

## State Management
Pull everything from the authenticated user:
- **Profile:** display name, email, avatar.
- **Credit balance** (number) → Credit balance card + "≈ N conversations" estimate.
- **Subscription:** plan + status + renewal date → Subscription card.
- **Engagement:** current/best streak, sessions this week, minutes spoken → the two activity stat
  cards (drop these cards gracefully if you don't track them yet).
- **Active session** (if any) → the "resume" link.
- **Recent sessions[]**: `{ topic, level, turnsDone, turnsTotal, status, when }` → session cards
  (+ progress %). Empty → render `.empty`.
- **Frequent topics** → quick-start chips.
No client-only state; this is a read view that links out to the flows.

---

## Design Tokens
(From `styles.css` `:root` — port verbatim.)

**Surfaces** — `--paper #FBFAF6` · `--paper-2 #F4F1EA` (chip hover, done pill) · `--paper-3 #ECE8DF`
(progress track) · `--card #FFFFFF` (all cards).
**Ink** — `--ink #211E1A` (primary button, headings) · `--ink-2 #57524A` · `--ink-3 #8C857A` ·
borders `--line #E7E2D7` / `--line-2 #D9D3C6`.
**Accents** — lilac `#E8DEF8` + lilac-ink `#6A4FA3` (name accent, hero gradient, links) ·
peach `#FBE2D2` + peach-ink `#BF6233` · sky `#D8E7F4` + sky-ink `#3A6896` ·
mint `#DCEDE2` + mint-ink `#3C8868` (Active badge/pill). Progress bar = lilac-ink→peach-ink gradient.
**Radii** — cards 18px · feature/quick 28px · icon tiles 11px · pills 100px.
**Shadows** — `--shadow-sm` (cards), `--shadow` (hover). **Motion** — `--ease cubic-bezier(.22,.61,.36,1)`.

**Type** — display `Instrument Serif` (greeting, section titles, hero title, stat values);
body `Hanken Grotesk`. Greeting `36→54px` (`line-height 1.16`); section/hero titles 24–30px;
stat value 50px.
**Layout** — content `max-width 1200px`; greeting left col `flex 1 1 420px`; main grid `1.55fr / 1fr`.

---

## Assets
- **No raster images / no external assets** — logo, Alex orb, all icons, and the avatar are CSS +
  inline SVG. Swap the gradient avatar for the user's real photo when available.

## Copy
All copy lives in `app-dashboard.html` — reuse static copy (labels, hero text, "Jump back in")
verbatim. Sample values (name, 105 credits, streak, session titles) are illustrative — replace with
real account data. English UI.

## Files
- `app-dashboard.html` — full markup, copy, page-specific CSS.
- `styles.css` — shared design system (port/import first).

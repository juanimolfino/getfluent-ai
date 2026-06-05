# Handoff: GetFluent — Practice setup (pre-chat settings)

## Overview
The configuration screen of **GetFluent**, an app to practice spoken English in natural
conversations with an AI character named **Alex**. Before a conversation starts, the user sets up
the session here: **level** (A1–C2), **practice context** (native language + interests), and
**today's conversation** (a topic — including a "Surprise me" random option — a custom topic, and how
many user turns). A sidebar lists **recent sessions** (active / completed). The primary action starts
the chat.

Visual direction: editorial / warm. Cream + ink, `Instrument Serif` display, pastel lilac/peach/sky
accents. A guided, three-step panel that reads top-to-bottom.

---

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a working prototype of the
look, layout, copy, and selection behavior. They are **not meant to be shipped as-is**.

Your task: **recreate this screen in the target codebase** (React/Next, Vue, etc.), wired to real
data (user profile defaults, session history, credit balance). Reuse the tokens and component
structure rather than copying markup verbatim.

Files included:
- `app-settings.html` — the full setup screen (structure, copy, page-specific CSS, selection JS).
- `styles.css` — the **shared design system** (tokens, type, buttons, Alex orb, utilities).
  **Port this first**; shared across all GetFluent screens.

---

## Fidelity
**High-fidelity (hifi).** Final colors, type, spacing, interactions. Recreate pixel-faithfully.

---

## Tech / Dependencies
- **Fonts:** `Instrument Serif` (400/italic) + `Hanken Grotesk` (300–800), Google Fonts.
- **Icons:** inline stroke SVG (1.7–1.8). Swap for the project's set; keep thin/rounded. The select
  caret is an inline SVG background-image.
- **Prototype JS** (vanilla, ~15 lines): single-select behavior for the level grid and the topic
  chips (click sets `.on`, clears siblings). Reimplement as controlled inputs / state in the framework.
- Page **scrolls** normally (unlike the chat/login shells).

---

## Layout
Sticky top bar + a two-column content grid.

### Top bar (`.topbar`)
Translucent cream, `backdrop-filter: blur`, 1px bottom border, 66px tall. Logo left; right side has
a **credits pill** (e.g. "◆ 12 free credits") + an **"Upgrade"** ghost button.

### Page head
Big serif H1 *"Start a conversation with Alex."* ("Alex." italic lilac) + an 18px muted subhead.

### Content grid (`.layout`)
`grid-template-columns: 1fr 332px; gap: 26px; align-items: start;`
- **Main panel** (`.panel`) — the three setup blocks (see below).
- **Sidebar panel** (`.side`) — recent sessions.
- Collapses to **one column < 980px**.

---

## Components

### Setup block (`.block`)
Each step is a block separated by a top border + `38px` spacing. Header row: serif title (24px,
italic accent word) + a **"Step N"** pill (uppercase, paper-2 bg). A muted sub-line under it.

1. **Your level** — `.levels` grid (3 cols, 2 rows) of `.lvl` buttons. Each: big code (A1…C2, 22px/700)
   + tiny descriptor ("First conversations", "Fluent opinions", …). Selected (`.on`) = lilac border +
   lilac-tinted bg + 3px lilac ring + lilac code. Default selected: **B2**.
2. **Practice context** — two fields (`.two`, `1fr / 1.4fr`): a **native language** `<select>` and an
   **interests** text input (e.g. "travel, music, fútbol, guitar").
3. **Today's conversation** — a wrap of **topic chips** (`.topic`): single-select pill; selected =
   solid ink. A special **"✦ Surprise me"** chip (`.topic.random`) is dashed lilac → solid lilac when
   chosen (the random-topic generator). Below: a **custom topic** text input + a **user turns** number
   input (`.turns-row`, `1.6fr / 1fr`).

Bottom **start row** (`.start-row`): a summary line ("Ready: **B2 · Gaming · 8 turns** · voice +
text") + the primary **"Start practicing"** button (arrow icon) → navigates to the chat.

### Form controls
- `.ctrl` — inputs/selects: 15.5px, padding `12px 14px`, 1px `--line-2` border, radius 12px, white bg.
  Focus → lilac-ink border + 4px lilac ring. Custom caret on `<select>`.
- `.lab` — 13px / weight 600 / `--ink-2` field label.
- `.topic` — pill, 1px border, `--ink-2`; hover darkens; `.on` = solid ink, paper text.

### Recent sessions sidebar (`.side`)
Heading with a refresh icon. List of `.sess` cards: title (e.g. "Job interview · dive center"),
meta line (level · turns) + a status **pill** — `.active` (mint) or `.done` (paper-2/faint). Cards
nudge right on hover. Each links to its session.

### Alex orb / Logo
Same shared components as other screens (lilac→peach gradient orb with waveform; gradient circle
mark + wordmark). Orb not prominently used here beyond the logo, but available.

---

## Interactions & Behavior
- **Single-select** for level and for topic chips (selecting one clears the rest). In production these
  are controlled inputs bound to the session-config state.
- **"Surprise me"** should generate a creative random topic (per the product spec) — when chosen, you
  may auto-fill the custom-topic field or pass a "random" flag to the session.
- **Summary line** should reflect the live selections (level · topic · turns).
- **Start practicing** validates a minimal config and navigates to the chat with the config (and
  decrements/uses a credit).
- **Credits pill** reflects the real balance; **Upgrade** → pricing.
- **Focus rings** (lilac) on every control for keyboard use.
- **Responsive:** `< 980px` single column (sidebar drops below); level grid → 2 cols `< 540px`;
  field rows stack `< 600px`.

## State Management
- **Session config** object: `{ level, nativeLanguage, interests[], topic | randomFlag, customTopic, userTurns }`.
  Prefill `level`, `nativeLanguage`, `interests` from the user's profile/defaults.
- **Recent sessions[]**: fetched list `{ title, level, turnsDone, turnsTotal, status }` for the sidebar.
- **Credit balance** (drives the pill + gating).
- On **Start**, persist the config and route to the chat; the chat reads it to brief Alex.

---

## Design Tokens
(From `styles.css` `:root` — port verbatim.)

**Surfaces** — `--paper #FBFAF6` · `--paper-2 #F4F1EA` (step pills, chip hover) · `--card #FFFFFF` (panels/inputs).
**Ink** — `--ink #211E1A` (selected chip, CTA) · `--ink-2 #57524A` · `--ink-3 #8C857A` · borders `--line` / `--line-2`.
**Accents** — lilac `#E8DEF8` + lilac-ink `#6A4FA3` (selected level, random chip, focus ring) ·
mint `#DCEDE2` + mint-ink `#3C8868` (active status) · peach used in the progress gradient elsewhere.
**Radii** — panels 28px · cards/blocks 15–18px · inputs 12px · chips/pills 100px.
**Shadows** — `--shadow-sm` (panels), `--shadow` (card hover). **Motion** — `--ease cubic-bezier(.22,.61,.36,1)`.

**Type** — display `Instrument Serif` (H1, block titles); body `Hanken Grotesk`. H1 `40→58px`;
block titles 24px; controls 15.5px.
**Layout** — content `max-width 1200px`; grid `1fr / 332px`.

---

## Assets
- **No raster images / no external assets** — Alex orb, logo, icons, select caret are all CSS + inline SVG.

## Copy
All copy lives in `app-settings.html` — reuse static labels/headings verbatim. Sample values
(interests "travel, music, fútbol, guitar"; recent-session titles) are illustrative — replace with
real user data. English UI.

## Files
- `app-settings.html` — full markup, copy, page-specific CSS, selection JS.
- `styles.css` — shared design system (port/import first).

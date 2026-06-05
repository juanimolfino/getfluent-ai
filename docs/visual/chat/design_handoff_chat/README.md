# Handoff: GetFluent — Chat (practice session)

## Overview
The core screen of **GetFluent**, an app to practice spoken English in natural conversations with
an AI character named **Alex**. This is the **live conversation** view: the user speaks (mic) or
types, Alex replies in voice + text, and the transcript accumulates. Premium affordances —
**Translate / View original** and **Replay** — appear on Alex's messages. When the configured number
of turns is reached, a **"Session complete"** card invites the user to see their analysis.

Visual direction: editorial / warm. Cream + ink, pastel **lilac** user bubbles, gray-cream Alex
bubbles — chosen for comfort (the previous emerald-green chat felt too harsh).

---

## About the Design Files
The files in this bundle are **design references created in HTML/CSS** — a working prototype of the
look, layout, copy, and micro-interactions. They are **not meant to be shipped as-is**.

Your task: **recreate this screen in the target codebase** (React/Next, Vue, etc.) and wire it to
real speech + LLM services. Reuse the tokens and component structure rather than copying markup verbatim.

Files included:
- `app-chat.html` — the full chat screen (structure, sample transcript, page-specific CSS, demo JS).
- `styles.css` — the **shared design system** (tokens, type, buttons, Alex orb, utilities).
  **Port this first**; it's shared across all GetFluent screens.

---

## Fidelity
**High-fidelity (hifi).** Final colors, type, spacing, interactions. Recreate pixel-faithfully.

---

## Tech / Dependencies
- **Fonts:** `Instrument Serif` (400/italic) + `Hanken Grotesk` (300–800), Google Fonts.
- **Icons:** inline stroke SVG (1.7–1.8). Swap for the project's set; keep thin/rounded.
- **Prototype JS** (vanilla, ~30 lines — reimplement with framework idioms):
  - Translate toggle: flips a hidden `.translated` block and swaps the button label
    "Translate" ↔ "View original".
  - Mic button: toggles a `.rec` class that shows an animated equalizer in the composer and hides
    the text input.
  - Send: appends a user bubble from the text input (Enter or send button).
  - These are **demo stand-ins** — replace with real speech-to-text, TTS, and streaming LLM responses.
- **`100vh` app shell, no page scroll** — only the message stream scrolls.

---

## Layout
App shell grid: `grid-template-columns: 300px 1fr; height: 100vh;`

### Left — session sidebar (`.aside`)
`--paper` bg, 1px right border, `22px` padding, flex-column.
- "← Practice setup" back link.
- "PRACTICE SESSION" label + serif session title (e.g. "Gaming", 30px).
- Meta rows: **Level** (e.g. "B2 · Fluent opinions"), **Progress** (e.g. "5 / 5 user turns" + a
  gradient progress bar `.bar`), **Status** (e.g. "Completed" in mint-ink).
- Spacer pushes a destructive **"End conversation"** button to the bottom (red-tinted ghost).
- **Hidden below 880px** (mobile shows just the conversation).

### Right — conversation (`.main`)
Flex-column, full height, three rows:
1. **`.chat-top`** (64px, fixed) — Alex orb + "Alex" + "Natural voice · English" with a green live
   dot (left); two icon buttons (transcript, settings) right.
2. **`.stream`** (flex: 1, scrolls) — inner column `max-width 760px`, centered, message rows `gap 16px`.
3. **`.composer`** (fixed bottom) — the input bar + hint.

---

## Components

### Message rows (`.row.alex` / `.row.user`)
- **Alex:** 34px Alex orb avatar + bubble. Bubble bg `--card`, 1px `--line` border, radius 20px,
  bottom-left corner squared (7px), soft shadow. 16px text, `line-height 1.5`.
  - **`.b-tools`** footer (divider on top): **Replay** button (speaker icon) + **Translate** button
    (translate icon). 13px / weight 600 / `--ink-2`; hover → lilac-ink.
  - **`.translated`** block (hidden by default; shown via `.show`): dashed top border, italic
    `--ink-2`, the Spanish translation.
- **User:** right-aligned bubble, bg `--lilac` (#E8DEF8), ink text, bottom-right corner squared. No avatar.

### Session-complete card (`.complete`)
Appears after the last turn. Subtle mint→white gradient, 1px border, radius 18px. Left: serif
"Session complete" + a line of copy. Right: primary **"See my analysis"** button (bar-chart icon).
*(The analysis screen itself is a separate, not-yet-designed view.)*

### Composer (`.composer` / `.input-shell`)
- Pill-shaped input shell: `--card` bg, 1px `--line-2` border, radius 100px, `8px 8px 8px 20px` pad,
  soft shadow. **Recording state** (`.rec`) → lilac border + 4px lilac focus ring.
- Contents: **text input** (`.text-in`, hidden while recording) **or** an animated **equalizer**
  (`.mic-eq`, lilac bars, shown while recording); a circular **mic button** (`.mic-btn`, lilac → turns
  solid lilac-ink while recording); a circular ink **send button**.
- Hint line below (centered, 12.5px): *"Tip: speak naturally — pause and resume any time. Your
  transcript builds up so nothing is lost."*

### Alex orb (`.alex-orb`)
Lilac→peach gradient circle with a 5-bar voice waveform animating on staggered delays. Used at
36px (top + avatars). **Respect `prefers-reduced-motion`.**

### Icon button (`.icobtn`)
38px, radius 11px, 1px border, `--ink-2` icon; hover darkens + border darkens.

---

## Interactions & Behavior
- **Translate ↔ View original:** per Alex message, toggles `.translated.show` and swaps the button
  label. In production, fetch the translation in the user's native language on demand (cache it).
- **Replay:** re-plays Alex's TTS audio for that message (premium).
- **Mic record:** toggles `.rec` on the input shell + mic button (shows equalizer, hides text input).
  Hook to real speech-to-text; while recording, stream partial transcripts.
- **Pause & resume:** the spec requires that pausing never loses prior speech — the transcript
  accumulates across pauses. Persist the in-progress user turn until they send.
- **Send:** appends the user's turn, then request Alex's next reply (stream tokens into a new Alex
  bubble; play TTS when ready).
- **Auto-scroll:** keep the newest message in view as it arrives (use a scroll-to-bottom on the
  stream container — **do not** use `scrollIntoView`, which can disrupt the layout; set
  `container.scrollTop = container.scrollHeight` or scroll the last node with `{block:'nearest'}`).
- **Turn limit:** when user turns reach the configured count, render the session-complete card and
  stop prompting; Alex gives a closing line. (Alex only says goodbye at the end.)
- **Responsive:** `< 880px` hides the sidebar; the conversation goes full width.

## State Management
This is the most stateful screen. Model at minimum:
- **Session config** (from the practice-setup screen): level, topic, native language, target turn count.
- **Messages[]**: `{ role: 'alex'|'user', text, audioUrl?, translation? }`. Append as the
  conversation proceeds; this is the accumulating transcript.
- **Turn counter / progress** (drives the sidebar bar + completion).
- **Recording state**, **in-progress partial transcript** (must survive pause/resume).
- **Per-message UI**: translation shown?, audio playing?.
- **Premium flag**: gates Translate / Replay / natural voice (free shows upsell instead).
- Persist the session so a refresh restores the transcript and position.

---

## Design Tokens
(From `styles.css` `:root` — port verbatim.)

**Surfaces** — `--paper #FBFAF6` (sidebar/top) · `--paper-2 #F4F1EA` (chat bg via body) ·
`--card #FFFFFF` (Alex bubble, composer).
**Ink** — `--ink #211E1A` · `--ink-2 #57524A` · `--ink-3 #8C857A` · borders `--line #E7E2D7` / `--line-2 #D9D3C6`.
**User bubble** — `--lilac #E8DEF8`, ink text. **Accents** — lilac-ink `#6A4FA3` (record/translate),
mint-ink `#3C8868` (status/complete). End-conversation red ≈ `#B4452F`.
**Radii** — bubbles 20px (one corner 7px) · composer pill 100px · icon button 11px.
**Shadows** — `--shadow-sm` (bubbles/composer). **Motion** — `--ease cubic-bezier(.22,.61,.36,1)`.

**Type** — display `Instrument Serif` (session title, "Session complete"); body `Hanken Grotesk`,
messages 16px / line-height 1.5.
**Layout** — shell `300px / 1fr`; stream inner `max-width 760px`.

---

## Assets
- **No raster images / no external assets** — Alex orb + all icons are CSS + inline SVG.
- Real audio (Alex TTS, user recordings) is added at integration time; no static audio in the prototype.

## Copy
Sample transcript copy lives in `app-chat.html` — it's illustrative (a "Gaming" session); real
content is generated by the LLM at runtime. Reuse the **static** copy (hint line, button labels,
"Session complete") verbatim. English UI.

## Files
- `app-chat.html` — full markup, sample transcript, page-specific CSS, demo JS.
- `styles.css` — shared design system (port/import first).

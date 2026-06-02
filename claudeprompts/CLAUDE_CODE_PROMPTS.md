# Fluent — Etapa 1: Checklist + Prompts para Claude Code

Cada bloque es un prompt independiente. Mandárselos a Claude Code de a uno,
esperar que termine y confirme, luego pasar al siguiente.
No mezclar pasos en un mismo prompt.

---

## CHECKLIST DE ESTADO

Marcar cada ítem cuando Claude Code lo complete:

### Bloque 1 — Setup inicial del proyecto
- [ ] 1.1 Clonar template y renombrar proyecto a "fluent"
- [ ] 1.2 Instalar dependencias adicionales
- [ ] 1.3 Configurar variables de entorno

### Bloque 2 — Base de datos
- [ ] 2.1 Agregar enums y tablas al schema de Drizzle
- [ ] 2.2 Generar y correr migración
- [ ] 2.3 Aplicar políticas RLS en Supabase

### Bloque 3 — Lógica del servidor (lib/)
- [ ] 3.1 Crear fluent-queries.ts (funciones de DB)
- [ ] 3.2 Crear conversation-prompt.ts (prompt del sistema de Alex)
- [ ] 3.3 Crear elevenlabs.ts (helper de TTS)

### Bloque 4 — API Routes
- [ ] 4.1 Crear POST /api/conversation/start
- [ ] 4.2 Crear POST /api/conversation/turn
- [ ] 4.3 Crear GET/POST /api/user-profile/language

### Bloque 5 — UI Components
- [ ] 5.1 Crear SetupForm.tsx (onboarding 3 pasos)
- [ ] 5.2 Crear ConversationView.tsx (interfaz de conversación)

### Bloque 6 — Pages de Next.js
- [ ] 6.1 Crear page /practice (setup)
- [ ] 6.2 Crear page /practice/[sessionId] (conversación)
- [ ] 6.3 Agregar link "Start practicing" en el dashboard

### Bloque 7 — Verificación final
- [ ] 7.1 Correr el servidor y verificar que no hay errores de TypeScript
- [ ] 7.2 Testear flujo completo: setup → conversación → completar sesión

---

## PROMPTS PARA CLAUDE CODE

---

### PROMPT 1.1 — Clonar y renombrar el proyecto

```
Use the GitHub template at https://github.com/juanimolfino/ai-saas-base to create a new project.

1. Clone the repo locally (or create from template on GitHub first, then clone).
2. Rename the project to "fluent" — update the `name` field in package.json to "fluent".
3. Run `npm install` to confirm dependencies install correctly.
4. Copy `.env.example` to `.env.local`.

Report what's in `.env.local` so I know which keys I need to fill in.
Do not modify any other files yet.
```

---

### PROMPT 1.2 — Instalar dependencias adicionales

```
We're building Fluent, an English conversation practice app on top of this Next.js project.

Install one additional npm package:
  npm install @anthropic-ai/sdk

Then confirm the package appears in package.json dependencies.
Do not modify any other files.
```

---

### PROMPT 1.3 — Variables de entorno

```
Add the following keys to .env.example (with empty values and comments explaining each):

# ElevenLabs — AI voice text-to-speech
ELEVENLABS_API_KEY=
# Optional: override default voice ID (default is Rachel, warm American English)
# ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Anthropic Claude API (used for conversation AI and analysis)
ANTHROPIC_API_KEY=

Then add the same keys to .env.local with the real values I'll provide.
I'll paste the values after you confirm the file is ready.
Do not change anything else.
```

---

### PROMPT 2.1 — Schema de Drizzle (nuevas tablas)

```
In lib/db/schema.ts, add the following at the bottom of the file (after the existing exports).
Do not modify anything that already exists in the file — only append.

Add these three enums:
- englishLevelEnum: pgEnum("english_level", ["A1","A2","B1","B2","C1","C2"])
- nativeLanguageEnum: pgEnum("native_language", ["spanish","portuguese","french","italian","german","other"])
- sessionStatusEnum: pgEnum("session_status", ["setup","active","completed","analyzed"])

Add these two tables:

Table 1: userLanguageProfiles ("user_language_profiles")
Columns:
- id: uuid, primary key, defaultRandom()
- userId: uuid("user_id"), notNull, unique  ← FK to users.id (add relation comment)
- nativeLanguage: nativeLanguageEnum, notNull, default "spanish"
- englishLevel: englishLevelEnum, notNull, default "A1"
- interests: jsonb, type string[], notNull, default []
- preferredTopics: jsonb, type string[], notNull, default []
- createdAt: timestamp, notNull, defaultNow()
- updatedAt: timestamp, notNull, defaultNow()

Table 2: conversationSessions ("conversation_sessions")
Also export a ConversationTurn type:
  { role: "assistant" | "user"; content: string; audioUrl?: string; timestamp: string }

Columns:
- id: uuid, primary key, defaultRandom()
- userId: uuid("user_id"), notNull
- status: sessionStatusEnum, notNull, default "setup"
- englishLevel: englishLevelEnum, notNull
- topic: text, notNull
- targetTurns: integer, notNull, default 10
- completedTurns: integer, notNull, default 0
- turns: jsonb, type ConversationTurn[], notNull, default []
- transcript: text (nullable)
- creditsUsed: integer, notNull, default 0
- createdAt: timestamp, notNull, defaultNow()
- updatedAt: timestamp, notNull, defaultNow()

After adding, show me the final lines you added so I can confirm they look right.
Do not run migrations yet.
```

---

### PROMPT 2.2 — Migración de Drizzle

```
Run the Drizzle migration commands in order:

  npm run db:generate
  npm run db:migrate

If there are any errors, show them to me.
If successful, confirm the migration ran and show the name of the generated migration file.
Do not modify any code.
```

---

### PROMPT 2.3 — RLS policies en Supabase

```
Create a new file at lib/db/fluent-rls.sql with the following SQL.
I will run this manually in the Supabase SQL editor.

The SQL should:
1. Enable RLS on user_language_profiles and conversation_sessions tables.
2. Add SELECT, INSERT, UPDATE policies on user_language_profiles that allow users
   to access only their own row, using:
   user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
3. Add SELECT, INSERT, UPDATE policies on conversation_sessions with the same pattern.

Name each policy clearly, e.g.:
  "Users can read own language profile"
  "Users can insert own language profile"
  "Users can update own language profile"
  "Users can read own sessions"
  "Users can insert own sessions"
  "Users can update own sessions"

Show me the file content when done.
```

---

### PROMPT 3.1 — DB Queries (fluent-queries.ts)

```
Create a new file at lib/db/fluent-queries.ts.

This file exports the following async functions.
Import db from "@/lib/db", and the new tables/types from "@/lib/db/schema".
Use drizzle-orm's `eq` for where clauses.

Functions to implement:

1. getUserLanguageProfile(userId: string)
   → select from userLanguageProfiles where userId matches, return first or null

2. upsertUserLanguageProfile(userId, data: { nativeLanguage, englishLevel, interests, preferredTopics })
   → if profile exists, update it; otherwise insert it. Return the result.

3. createConversationSession(data: { userId, englishLevel, topic, targetTurns })
   → insert into conversationSessions with status "active", turns [], completedTurns 0. Return result.

4. getConversationSession(sessionId: string, userId: string)
   → select session by id, return null if not found or userId doesn't match

5. appendTurnToSession(sessionId: string, turn: ConversationTurn)
   → load session, spread existing turns + new turn, count user turns for completedTurns, update and return

6. completeConversationSession(sessionId: string)
   → build a flat transcript string ("AI: ...\nUser: ...\n"), set status to "completed",
     save transcript, update and return

7. getUserRecentSessions(userId: string, limit = 10)
   → select sessions ordered by createdAt desc, limit by param

Show me the completed file.
```

---

### PROMPT 3.2 — Conversation Prompt (conversation-prompt.ts)

```
Create a new file at lib/conversation/conversation-prompt.ts.

Export a type ConversationConfig:
  { englishLevel, topic, nativeLanguage, targetTurns, completedTurns }
  (englishLevel is "A1"|"A2"|"B1"|"B2"|"C1"|"C2")

Export a function buildConversationSystemPrompt(config: ConversationConfig): string

The function returns a system prompt for an AI conversation partner called "Alex".
The prompt must include:

1. Character: Alex is a friendly, warm, human English conversation partner.
   Alex never breaks character or reveals being an AI.

2. Level-specific instructions — include a LEVEL_GUIDANCE record with instructions for each level:
   - A1: only common words, max 8-word sentences, simple present/past only, no contractions
   - A2: everyday vocab, max 12 words, present/past/future simple, model corrections naturally
   - B1: natural English, mix tenses, common phrasal verbs, react naturally
   - B2: rich vocabulary, idioms, complex sentences, ask "why/how/what do you think"
   - C1: sophisticated language, debate, irony, push critical thinking
   - C2: full native-level speech, humor, cultural references, no simplification

3. Topic starter — include a TOPIC_STARTERS record for: football, technology, travel,
   music, movies, food, sports, gaming, science, business.
   Each starter is one sentence telling Alex how to open the conversation.

4. Behavioral rules (numbered list in the prompt):
   - Never break character
   - Keep turns to 2-4 sentences max
   - Always end with ONE question
   - React naturally with interest/surprise/agreement
   - If user writes in their native language, reply in English and gently encourage English
   - Do not over-correct grammar
   - Be warm, curious, fun — like a real friend
   - If user gives a very short answer, ask a follow-up

5. Closing: if turnsLeft <= 2, tell Alex to naturally wrap up the conversation warmly.

Show me the completed file.
```

---

### PROMPT 3.3 — ElevenLabs TTS helper

```
Create a new file at lib/conversation/elevenlabs.ts.

This module handles text-to-speech using the ElevenLabs API.

Requirements:
- Read ELEVENLABS_API_KEY from process.env
- Read ELEVENLABS_VOICE_ID from process.env, default to "21m00Tcm4TlvDq8ikWAM" (Rachel voice)
- Use model "eleven_turbo_v2_5" (fastest, lowest latency)
- Voice settings: stability 0.5, similarity_boost 0.75, style 0.3, use_speaker_boost true

Export a type TTSResult: { audioBuffer: Buffer; contentType: "audio/mpeg" }

Export an async function textToSpeech(text: string): Promise<TTSResult>
- POST to https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
- Accept: audio/mpeg
- On non-ok response, throw an error with status and body text
- Return the audio as a Buffer with contentType "audio/mpeg"

Do not use any ElevenLabs SDK — use fetch directly.
Show me the completed file.
```

---

### PROMPT 4.1 — API Route: /api/conversation/start

```
Create a new file at app/api/conversation/start/route.ts.

This is a Next.js App Router POST route handler.

Flow:
1. Authenticate user via createSupabaseServerClient() and supabase.auth.getUser()
   Return 401 if not authenticated.
2. Get the internal db user from the `users` table where authUserId matches.
   Return 404 if not found.
3. Validate the request body with zod:
   { topic: string (min 1, max 100), englishLevel?: enum of levels, targetTurns?: number (4-30, default 10) }
   Return 400 with error details if invalid.
4. Load the user's language profile via getUserLanguageProfile(). 
   Use profile.englishLevel if no override in body. Default to "A1" if no profile.
5. Create a new conversation session via createConversationSession().
6. Build the system prompt via buildConversationSystemPrompt() with completedTurns: 0.
7. Call the Anthropic API (claude-sonnet-4-20250514, max_tokens: 200) with the system prompt.
   The first user message should be "[START CONVERSATION]".
8. Extract the AI text from the response.
9. Call textToSpeech(aiText) to get audio. If it fails, log the error and continue with audioBase64: null.
10. Return JSON:
    { sessionId, turn: { role: "assistant", content, audioBase64, timestamp }, session: { id, topic, englishLevel, targetTurns, completedTurns: 0 } }

Wrap everything in try/catch. Return 500 on unexpected errors.
Import Anthropic from "@anthropic-ai/sdk".
Show me the completed file.
```

---

### PROMPT 4.2 — API Route: /api/conversation/turn

```
Create a new file at app/api/conversation/turn/route.ts.

This is a Next.js App Router POST route handler.

Flow:
1. Authenticate via Supabase. Return 401 if not authenticated.
2. Get internal db user. Return 404 if not found.
3. Validate body with zod: { sessionId: uuid string, userText: string (min 1, max 2000) }
4. Load session via getConversationSession(sessionId, userId). Return 404 if not found.
   Return 400 if session.status !== "active".
5. Append the user turn via appendTurnToSession().
6. Check if isLastTurn: updatedSession.completedTurns >= targetTurns.
7. Build claude messages array from the last 20 turns of the session (map role/content).
8. Build system prompt via buildConversationSystemPrompt() with current completedTurns.
9. Call Anthropic API (claude-sonnet-4-20250514, max_tokens: 250) with the full message history.
10. Extract AI text. Append AI turn via appendTurnToSession().
11. If isLastTurn, call completeConversationSession().
12. Call textToSpeech() for audio. If it fails, log and use audioBase64: null.
13. Return JSON:
    { turn: { role: "assistant", content, audioBase64, timestamp }, session: { completedTurns, targetTurns, isComplete } }

Wrap in try/catch. Return 500 on errors.
Show me the completed file.
```

---

### PROMPT 4.3 — API Route: /api/user-profile/language

```
Create a new file at app/api/user-profile/language/route.ts.

Export two handlers: GET and POST.

GET:
1. Authenticate via Supabase. Return 401 if not authenticated.
2. Get internal db user. Return 404 if not found.
3. Call getUserLanguageProfile(). Return { profile } (can be null if not set up yet).

POST:
1. Authenticate. Return 401 if not authenticated.
2. Get db user. Return 404 if not found.
3. Validate body with zod:
   { nativeLanguage: enum (spanish|portuguese|french|italian|german|other), default "spanish"
     englishLevel: enum (A1|A2|B1|B2|C1|C2)
     interests: array of strings, min 1, max 10 items
     preferredTopics: array of strings, min 1, max 5 items }
4. Call upsertUserLanguageProfile() and return { profile }.

Wrap both in try/catch. Return 500 on errors.
Show me the completed file.
```

---

### PROMPT 5.1 — SetupForm component

```
Create a new file at components/setup/SetupForm.tsx.
Mark it "use client" at the top.

This is a 3-step onboarding form that collects:
- Step 1: English level (A1 to C2) — show label + short description for each
- Step 2: Interests (multi-select, max 5) — options: football, technology, travel, music, movies, food, sports, gaming, science, business (show with emoji)
- Step 3: Today's topic (single select from same interest list) + session length (6 turns ~5min, 10 turns ~10min, 16 turns ~15min)

UI requirements:
- Progress bar at top showing current step (3 segments, filled up to current step)
- Each option is a full-width button with active/selected styling (indigo border + light indigo background)
- Back and Continue buttons between steps
- Final step has "Start talking 🎙️" button that is disabled if no topic selected

On submit:
1. POST to /api/user-profile/language with { nativeLanguage: "spanish", englishLevel, interests, preferredTopics: [selectedTopic] }
2. POST to /api/conversation/start with { topic: selectedTopic, englishLevel, targetTurns }
3. On success, use Next.js router.push to navigate to /practice/[sessionId]
4. Show loading state on the button while submitting
5. Show an error message if something fails

Use Tailwind CSS for all styling. No external UI libraries.
Show me the completed file.
```

---

### PROMPT 5.2 — ConversationView component

```
Create a new file at components/conversation/ConversationView.tsx.
Mark it "use client" at the top.

Props:
  sessionId: string
  initialTurn: { role: "assistant", content: string, audioBase64: string | null, timestamp: string }
  initialMeta: { id: string, topic: string, englishLevel: string, targetTurns: number, completedTurns: number }

State to manage:
- turns: array of turns (start with initialTurn)
- isListening, isProcessing, isPlaying: booleans
- liveTranscript: string (shown while user is speaking)
- error: string | null
- isComplete: boolean

Behavior:

AUDIO PLAYBACK:
- On mount, play initialTurn audio (if audioBase64 exists, use Audio element with data:audio/mpeg;base64,...).
- On each new assistant turn, play its audio automatically.
- Fallback: if no audioBase64, use window.speechSynthesis to speak the text in en-US at rate 0.9.
- Track isPlaying state via audio.onended / utterance.onend.

SPEECH RECOGNITION (Web Speech API):
- Use window.SpeechRecognition or window.webkitSpeechRecognition.
- lang: "en-US", interimResults: true, continuous: false.
- On result: update liveTranscript with the interim text.
- On end: if transcript is non-empty, call sendUserTurn(transcript).
- On error (not "no-speech"): show error message.
- Show an error if browser doesn't support it (recommend Chrome/Edge).

MIC BUTTON behavior:
- Hold to speak (onMouseDown/onTouchStart starts, onMouseUp/onTouchEnd stops recognition).
- Disabled while isProcessing or isPlaying.
- Shows "Hold to speak" / "Release to send" / "Processing..." labels.
- Visual states: normal (indigo), listening (red + scale-95), disabled (gray).

SEND TURN:
- Optimistically add user turn to turns array.
- POST to /api/conversation/turn with { sessionId, userText }.
- On success: add AI turn, update meta.completedTurns. If session.isComplete, setIsComplete(true).
- On error: show error message, remove optimistic turn.

COMPLETION STATE:
- When isComplete is true, show a congratulations screen with session stats and a button
  "See my analysis →" that navigates to /practice/[sessionId]/analysis.

LAYOUT:
- Full height flex column (header / transcript scroll area / controls).
- Header: shows "Alex" name, topic + level, turn progress (X/Y) + progress bar.
- Transcript: scrollable, auto-scrolls to bottom on new turns.
  Assistant bubbles: left-aligned, gray background.
  User bubbles: right-aligned, indigo background.
  Show liveTranscript as italic indigo bubble while listening.
  Show typing animation (3 bouncing dots) while isProcessing.
- Controls area: mic button (full width), replay button (icon), tip text below.

Include a replay button that re-plays the last assistant turn's audio.
Auto-scroll using a ref on a div at the bottom of the turns list.

Use only Tailwind CSS. No external UI libraries.
Show me the completed file.
```

---

### PROMPT 6.1 — Page: /practice

```
Create a new file at app/(dashboard)/practice/page.tsx.

This is a Next.js App Router server component (no "use client").

Requirements:
1. Import createSupabaseServerClient from "@/lib/supabase/server".
2. Get the current user. If no user, redirect to "/login".
3. Export metadata: { title: "Start Practice — Fluent" }
4. Render a full-height white page with the SetupForm component centered.

Import SetupForm from "@/components/setup/SetupForm".
Show me the completed file.
```

---

### PROMPT 6.2 — Page: /practice/[sessionId]

```
Create a new file at app/(dashboard)/practice/[sessionId]/page.tsx.

This is a Next.js App Router server component.

Props: { params: { sessionId: string } }

Requirements:
1. Authenticate with Supabase. Redirect to "/login" if no user.
2. Get the internal db user (from `users` table where authUserId matches). Redirect to "/login" if not found.
3. Call getConversationSession(params.sessionId, dbUser.id). Call notFound() if null.
4. Get the turns from session.turns as ConversationTurn[].
5. Find the first assistant turn. If none exists, redirect to "/practice".
6. Render ConversationView with:
   - sessionId: session.id
   - initialTurn: the first assistant turn
   - initialMeta: { id, topic, englishLevel, targetTurns, completedTurns } from session

Import ConversationView from "@/components/conversation/ConversationView".
Import ConversationTurn type from "@/lib/db/schema".
Show me the completed file.
```

---

### PROMPT 6.3 — Dashboard link

```
In app/(dashboard)/dashboard/page.tsx, find the main content area of the dashboard
and add a prominent "Start practicing" card or button that links to /practice.

The button/card should:
- Show a microphone emoji or icon
- Text: "Start a new conversation"
- Subtext: "Practice English with AI"
- Be a link (<a href="/practice">) styled with Tailwind
- Be placed visibly near the top of the dashboard content

Do not remove or break any existing dashboard functionality.
Show me the section you modified.
```

---

### PROMPT 7.1 — TypeScript check

```
Run the TypeScript compiler in check mode to find any type errors:

  npx tsc --noEmit

If there are errors, show me each one. Fix them one by one starting with the most critical.
Common things to check:
- Import paths using @/ alias
- Type mismatches in Drizzle queries (jsonb fields need explicit casting)
- Missing props on components
- Any missing type imports

After fixing, run tsc --noEmit again and confirm it passes with 0 errors.
```

---

### PROMPT 7.2 — Test del flujo completo

```
Start the dev server with `npm run dev` and confirm it starts without errors.

Then walk me through testing this flow manually:
1. Go to /login — confirm the login page loads.
2. After login, go to /dashboard — confirm the "Start practicing" button is visible.
3. Click it — confirm /practice loads with the 3-step setup form.
4. Complete the form (pick any level, interests, topic, length).
5. Confirm the app navigates to /practice/[sessionId].
6. Confirm the conversation UI loads and Alex's first message appears.
7. If ElevenLabs is configured, confirm audio plays.
8. Hold the mic button, say something in English, release — confirm the turn is sent and Alex responds.

Report any errors you see in the browser console or terminal.
Fix any issues found before marking this step complete.
```

---

## NOTAS PARA TRABAJAR CON CLAUDE CODE

- **Un prompt a la vez.** Nunca mandar el siguiente hasta que el anterior esté confirmado y sin errores.
- **Siempre pedirle que muestre el archivo** al final de cada prompt ("Show me the completed file") — así podés revisarlo antes de avanzar.
- **Si algo falla**, darle el error exacto en el siguiente mensaje. No empezar un prompt nuevo.
- **Los prompts 2.3 (RLS)** requiere acción manual tuya en Supabase SQL editor — Claude Code no puede hacer eso.
- **El prompt 7.2** es el único que requiere que vos pruebes manualmente en el browser.

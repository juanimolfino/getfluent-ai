# Fluent — Fase A: MVP Free con Streaming + Voz del Navegador

Esta fase reemplaza el flujo "request/response" de la Etapa 1 original por un flujo
de **streaming de texto**. El resultado es el MVP gratuito: Claude streamea el texto
de Alex token por token, y la voz del navegador (Web Speech API) lo habla a medida
que aparece.

**Decisión de arquitectura central:** construimos esto "premium-ready". El endpoint
de streaming, el manejo de turnos y el estado del frontend serán los mismos que use
la Fase B (premium con ElevenLabs). Pasar a premium será agregar una rama, no reescribir.

---

## PRINCIPIOS PARA CODEX EN ESTA FASE

- El streaming de texto de Claude es el corazón. Tiene que quedar limpio y reutilizable.
- El frontend mantiene el estado vivo de la conversación. La DB se actualiza async,
  nunca en el camino crítico de la respuesta.
- Nada de `audioBase64` en la DB. Solo transcript estructurado: { role, content, timestamp }.
- Cada paso se testea antes de avanzar. Un prompt a la vez.

---

## CHECKLIST DE ESTADO — FASE A

### Bloque A1 — Endpoint de streaming
- [ ] A1.1 Crear el endpoint POST /api/conversation/stream que streamea la respuesta de Claude
- [ ] A1.2 Guardado async del turno del usuario y del turno de Alex (sin bloquear el stream)
- [ ] A1.3 Detección de fin de sesión (último turno) dentro del stream

### Bloque A2 — Hook de streaming en el frontend
- [ ] A2.1 Crear un hook useConversationStream que consume el stream de texto
- [ ] A2.2 Integrar voz del navegador (speechSynthesis) que habla el texto a medida que llega
- [ ] A2.3 Manejar estados: streaming, hablando, esperando turno del usuario

### Bloque A3 — Actualizar la UI de conversación
- [ ] A3.1 Refactorizar ConversationView para usar el hook de streaming
- [ ] A3.2 Mostrar el texto apareciendo token por token mientras la voz habla
- [ ] A3.3 Botón de replay usando la voz del navegador

### Bloque A4 — Verificación Fase A
- [ ] A4.1 TypeScript check limpio
- [ ] A4.2 Test del flujo completo de streaming free

---

## PROMPTS PARA CODEX — FASE A

---

### PROMPT A1.1 — Endpoint de streaming de texto

```
We are upgrading Fluent's conversation flow to use streaming. Create a new API route
at app/api/conversation/stream/route.ts that streams Claude's response token by token.

This replaces the non-streaming /api/conversation/turn route for the conversation itself.
Keep the old route for now; we'll remove it once streaming is verified.

Requirements:

1. POST handler. Authenticate via Supabase (401 if no user). Get internal db user (404 if none).

2. Validate body with zod: { sessionId: uuid string, userText: string (1-2000 chars) }.

3. Load the session via getConversationSession(sessionId, userId). 404 if not found,
   400 if status !== "active".

4. Append the user turn via appendTurnToSession() — but do NOT await this in a way that
   blocks the stream start. Fire it, then proceed. (We'll handle ordering in A1.2.)

5. Build the Claude message history from the last 20 turns. Build the system prompt via
   buildConversationSystemPrompt() with current completedTurns.

6. Call the Anthropic SDK with stream: true:
   anthropic.messages.stream({ model: "claude-sonnet-4-20250514", max_tokens: 250, system, messages })

7. Return a streaming Response using a ReadableStream. For each text delta from Claude,
   enqueue it to the client as a Server-Sent Events (SSE) chunk in this format:
     data: {"type":"text","delta":"<token>"}\n\n
   When the stream finishes, send a final event with the full text:
     data: {"type":"done","fullText":"<complete text>","isComplete":<bool>}\n\n

8. Set response headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive.

Keep all business logic readable. Wrap the Anthropic call in try/catch and, on error,
enqueue: data: {"type":"error","message":"..."}\n\n then close the stream.

Show me the completed file. Do not modify the frontend yet.
```

---

### PROMPT A1.2 — Guardado async de turnos

```
Now handle the database writes for the streaming route WITHOUT blocking the stream.

In app/api/conversation/stream/route.ts:

1. Before starting the Claude stream, append the user's turn to the session
   (await appendTurnToSession for the user turn — we need it persisted and need the
   updated completedTurns count to decide if this is the last turn).

2. Compute isLastTurn = updatedSession.completedTurns >= targetTurns AFTER the user turn.

3. Accumulate Claude's full text as you stream deltas to the client.

4. When the Claude stream completes (in the "done" handler, after sending the done event
   to the client), append the assistant turn via appendTurnToSession(). This write happens
   after the client already has the full text, so it never delays the user experience.

5. If isLastTurn, call completeConversationSession() after saving the assistant turn.

Make sure the assistant-turn save and completeConversationSession run even though we've
already responded to the client — use the stream's flush/close lifecycle so the serverless
function stays alive until the writes finish. Add a short comment explaining why the
assistant save happens post-response.

Show me the updated file and explain the write ordering.
```

---

### PROMPT A1.3 — Señal de fin de sesión

```
Confirm the streaming route correctly signals session completion to the frontend.

In the "done" SSE event, include isComplete (boolean) so the frontend knows whether
to show the "See my analysis" screen.

Also include completedTurns and targetTurns in the done event so the frontend can update
its progress indicator:
  data: {"type":"done","fullText":"...","isComplete":<bool>,"completedTurns":<n>,"targetTurns":<n>}\n\n

Show me the final version of the done event handler.
```

---

### PROMPT A2.1 — Hook de consumo del stream

```
Create a new React hook at lib/hooks/useConversationStream.ts (mark the file "use client"
if needed, or ensure it's only imported by client components).

The hook manages sending a user turn and consuming the streamed Claude response.

Signature:
  useConversationStream({ sessionId, onComplete })

Returns:
  {
    sendTurn: (userText: string) => Promise<void>,
    streamingText: string,   // accumulates as tokens arrive
    isStreaming: boolean,
    error: string | null,
    sessionProgress: { completedTurns: number, targetTurns: number } | null,
  }

Behavior of sendTurn:
1. Set isStreaming true, reset streamingText to "".
2. POST to /api/conversation/stream with { sessionId, userText }.
3. Read the response body as a stream (response.body.getReader()).
4. Parse SSE chunks. For each "text" event, append delta to streamingText (use a ref +
   state update so React re-renders smoothly).
5. On "done" event: update sessionProgress, call onComplete({ fullText, isComplete, ... }).
6. On "error" event: set error.
7. Always set isStreaming false when the stream ends.

Handle partial SSE chunks correctly — a network read may split a "data:" line across two
reads. Buffer incomplete lines until you hit the \n\n delimiter.

Show me the completed hook. Do not wire it into the UI yet.
```

---

### PROMPT A2.2 — Voz del navegador sincronizada con el texto

```
Create a helper at lib/conversation/browser-voice.ts that speaks text using the
Web Speech API (speechSynthesis), designed to work alongside streaming text.

This is the FREE tier voice. It must be structured so the PREMIUM tier (ElevenLabs)
can later replace it behind the same interface.

Export an interface VoicePlayer:
  {
    speak: (text: string) => void,   // speak a full utterance
    stop: () => void,
    isSpeaking: () => boolean,
    onEnd: (callback: () => void) => void,
  }

Export a function createBrowserVoicePlayer(): VoicePlayer that implements the above
using window.speechSynthesis. Use lang "en-US", rate 0.95, and pick an English voice
if available (prefer a natural-sounding one from getVoices()).

Important design note in a comment: in the free tier, we wait for the full text from the
"done" event, then speak it. We do NOT speak partial tokens, because speechSynthesis
restarts awkwardly if fed incremental text. The text appears on screen token-by-token
(visual streaming) while the voice speaks the complete sentence once it's ready. This
keeps a single clean voice with no choppiness.

Show me the completed file.
```

---

### PROMPT A2.3 — Estados de la conversación en el hook

```
Extend the useConversationStream hook (or add a small companion hook) to expose a clear
conversation phase state so the UI can react:

phase: "idle" | "user_speaking" | "streaming" | "alex_speaking" | "complete"

- idle: waiting for the user to press the mic
- user_speaking: Web Speech API is capturing the user's voice
- streaming: Claude is streaming text (text appearing on screen)
- alex_speaking: browser voice is speaking Alex's full response
- complete: session reached target turns

The mic should be disabled during streaming and alex_speaking.

Show me how phase transitions are wired. Keep it simple and predictable.
```

---

### PROMPT A3.1 — Refactor de ConversationView con streaming

```
Refactor components/conversation/ConversationView.tsx to use the new streaming flow.

Replace the old fetch-to-/api/conversation/turn logic with:
- useConversationStream hook for sending turns and receiving streamed text
- createBrowserVoicePlayer for speaking Alex's responses
- the phase state for enabling/disabling controls

Keep the existing layout (header, transcript bubbles, mic button, replay button) but:
1. When streaming, show the streamingText accumulating in Alex's latest bubble in real time.
2. When the "done" event fires, finalize that bubble and trigger browser voice to speak the full text.
3. Disable the mic during "streaming" and "alex_speaking" phases.
4. Keep the existing Web Speech API logic for capturing the user's voice (that part is unchanged).
5. Keep the completion screen ("See my analysis") triggered by phase === "complete".

Preserve the optimistic user-turn rendering. Show me the refactored component.
```

---

### PROMPT A3.2 — Texto apareciendo token por token

```
Polish the streaming text display in ConversationView.

While phase === "streaming", Alex's current bubble should show streamingText updating
live as tokens arrive, with a subtle blinking cursor at the end (a thin │ that pulses).

When streaming finishes, remove the cursor and the bubble shows the final text.

Make sure auto-scroll keeps the growing bubble in view as text streams in.

Show me the relevant JSX and styling changes.
```

---

### PROMPT A3.3 — Replay con voz del navegador

```
Wire the replay button in ConversationView to re-speak the last assistant turn using
the browser voice player (player.speak with the last assistant turn's content).

Disable replay while phase is "streaming" or "alex_speaking".

Show me the updated replay handler.
```

---

### PROMPT A4.1 — TypeScript check

```
Run npx tsc --noEmit and fix any type errors introduced by the streaming refactor.
Pay attention to:
- SSE parsing types (the reader returns Uint8Array; decode with TextDecoder)
- The VoicePlayer interface implementation
- Hook return types

Run it again until it passes with 0 errors. Show me the final output.
```

---

### PROMPT A4.2 — Test del flujo de streaming free

```
Start the dev server and confirm it runs. Then guide me through testing:

1. Go through setup, start a session.
2. Confirm Alex's first message streams in token-by-token (not all at once).
3. Confirm the browser voice speaks Alex's message after the text finishes streaming.
4. Hold the mic, say something in English, release.
5. Confirm my turn appears, then Alex's reply streams in live with the blinking cursor.
6. Confirm the voice speaks the reply.
7. Confirm the mic is disabled while Alex is streaming/speaking.
8. Reach the turn limit and confirm the "See my analysis" screen appears.

Report any console errors or stream parsing issues. Fix before marking complete.
```

---

## NOTAS

- El endpoint viejo /api/conversation/turn se puede borrar después de A4.2, una vez
  confirmado que el streaming anda. No lo borres antes.
- La primera respuesta de Alex (la apertura) también debería streamear. Si el endpoint
  /api/conversation/start todavía la genera sin stream, en la Fase A conviene unificar:
  que start cree la sesión y el frontend pida el primer turno por /stream con un userText
  vacío o un marcador "[START]". Codex puede proponer la mejor forma — preguntarle en A3.1.

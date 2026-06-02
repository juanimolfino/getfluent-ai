# Fluent — Fase B: Premium con Streaming Coordinado (ElevenLabs + Texto)

Esta es la experiencia definitiva del producto: el chain de streaming completo.
Claude streamea texto → el backend lo reenvía a ElevenLabs por WebSocket → ElevenLabs
devuelve audio en chunks → el frontend reproduce el audio mientras el texto aparece
coordinado con la voz (karaoke "suficientemente bueno", no perfecto).

**Una sola voz natural de punta a punta. Sin cambio de tono. Se siente como hablar
con una persona.**

Esta fase se construye SOBRE la Fase A. La base de streaming de texto ya existe;
acá agregamos la rama de ElevenLabs y la coordinación audio-texto.

---

## PRINCIPIOS PARA CODEX EN ESTA FASE

- Esto NO es un MVP. Es el producto. Calidad de experiencia primero.
- El gating free/premium es real: solo usuarios premium usan este flujo. Verificar el
  tier del usuario antes de usar ElevenLabs.
- ElevenLabs cobra por caracteres. Implementar el cache de frases comunes desde el principio.
- Manejo robusto de errores: si ElevenLabs falla a mitad de stream, degradar a voz del
  navegador sin romper la conversación.
- WebSockets y audio chunked son delicados. Testear cada pieza aislada antes de encadenar.
- **Redis-ready, sin Redis todavía.** Todo el acceso al estado de la sesión (leer turnos,
  guardar turnos, leer/escribir progreso) debe pasar por UNA sola capa de funciones
  centralizada (ej: lib/conversation/session-state.ts). Hoy esas funciones hablan con
  Postgres. El día que sumemos Redis, solo cambia el interior de esas funciones — nada del
  resto del código. No metas Redis ahora; solo asegurá que el acceso esté centralizado así.

---

## CHECKLIST DE ESTADO — FASE B

### Bloque B0 — Capa de estado centralizada (Redis-ready)
- [ ] B0.1 Centralizar todo el acceso al estado de la sesión en una sola capa

### Bloque B1 — Gating de tier y setup de ElevenLabs streaming
- [ ] B1.1 Verificar tier premium del usuario (helper isPremiumUser)
- [ ] B1.2 Crear el cliente de WebSocket de ElevenLabs (input/output streaming)
- [ ] B1.3 Test aislado: enviar texto fijo a ElevenLabs WS y recibir audio chunks

### Bloque B2 — El chain de streaming en el backend
- [ ] B2.1 Conectar el stream de Claude al WebSocket de ElevenLabs (texto entra a medida que sale de Claude)
- [ ] B2.2 Multiplexar al cliente: enviar texto Y audio en el mismo stream SSE/WS
- [ ] B2.3 Incluir timestamps de caracteres de ElevenLabs para la sincronización

### Bloque B3 — Reproducción de audio chunked en el frontend
- [ ] B3.1 Cola de reproducción de audio chunks (Web Audio API / MediaSource)
- [ ] B3.2 Coordinar la aparición del texto con el avance del audio (karaoke aproximado)
- [ ] B3.3 Degradación elegante si el audio falla → voz del navegador

### Bloque B4 — Optimización de costos
- [ ] B4.1 Cache de audio de frases comunes por nivel
- [ ] B4.2 Medir y registrar caracteres usados por sesión (para créditos/billing)

### Bloque B5 — Verificación Fase B
- [ ] B5.1 TypeScript check limpio
- [ ] B5.2 Test del flujo premium completo + test de degradación

---

## PROMPTS PARA CODEX — FASE B

---

### PROMPT B0.1 — Capa de estado de la sesión centralizada

```
Before adding the premium features, refactor all session-state access into a single
centralized layer. This makes the codebase "Redis-ready" without adding Redis yet — later
we can swap the storage backend by editing only this file.

Create lib/conversation/session-state.ts that becomes the ONLY place that reads/writes
conversation session state. It wraps the existing fluent-queries functions:

  getSessionState(sessionId, userId)        -> loads a session (turns, progress, status)
  saveUserTurn(sessionId, turn)             -> persists a user turn, returns updated state
  saveAssistantTurn(sessionId, turn)        -> persists an assistant turn (async-friendly)
  markSessionComplete(sessionId)            -> consolidates transcript + sets status
  getSessionProgress(sessionId)             -> { completedTurns, targetTurns, status }

Internally these call the existing Postgres-backed fluent-queries today. Add a clear
comment at the top: "Single source of truth for session-state access. To move hot-path
reads/writes to Redis later, change only the implementations here — callers stay unchanged."

Then update the Phase A streaming route (and any other place that touches session state
directly) to go through this layer instead of calling fluent-queries directly.

Show me the new file and the list of call sites you updated. Run tsc --noEmit after.
```

---

### PROMPT B1.1 — Gating de tier premium

```
We're adding Fluent's premium voice experience. First, create a helper to check if a
user is on a premium plan.

Create lib/billing/tier.ts exporting:
  async function isPremiumUser(userId: string): Promise<boolean>

Look at how the base template tracks subscriptions/credits (check the existing schema
for a subscriptions, plans, or credits table, and the Stripe integration). Implement
isPremiumUser by checking the user's active subscription or plan tier.

If the base template uses a credits model instead of tiers, adapt: isPremiumUser returns
true if the user has an active paid subscription. Explain what table/field you used.

Show me the helper and which existing schema you relied on.
```

---

### PROMPT B1.2 — Cliente WebSocket de ElevenLabs

```
Create lib/conversation/elevenlabs-stream.ts — a client for ElevenLabs' WebSocket
streaming API (text input streaming → audio output streaming).

Reference: ElevenLabs WebSocket endpoint is
  wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_turbo_v2_5

Export an async function createElevenLabsStream(options):
  options: { voiceId?: string, onAudioChunk: (chunk: Buffer) => void, onCharTimings?: (timings) => void, onError, onClose }

The function:
1. Opens a WebSocket to the stream-input endpoint with the API key in the initial message.
2. Sends the BOS (beginning of stream) message with voice_settings (stability 0.5,
   similarity_boost 0.75) and the xi-api-key.
3. Exposes a method sendText(text: string) that sends a text chunk:
     { "text": "<chunk> ", "try_trigger_generation": true }
4. Exposes a method finish() that sends the EOS message: { "text": "" }
5. On incoming messages: decode the base64 audio in msg.audio and call onAudioChunk.
   If msg.normalizedAlignment / msg.alignment is present, call onCharTimings with it.
6. Handles errors and close cleanly.

Request character-level timestamps by including the appropriate flag so we get alignment
data back (we'll use it for text-audio sync).

Add comments explaining the BOS/EOS protocol. Show me the completed file.
Do not connect it to Claude yet.
```

---

### PROMPT B1.3 — Test aislado de ElevenLabs streaming

```
Create a small test script at scripts/test-elevenlabs-stream.ts that:
1. Calls createElevenLabsStream
2. Sends a fixed sentence in two or three text chunks (e.g. "Hello there! ", "How are you ", "doing today?")
3. Calls finish()
4. Collects all audio chunks, concatenates them, and writes the result to test-output.mp3
5. Logs whether character timings were received

Run it with: npx tsx scripts/test-elevenlabs-stream.ts

Confirm test-output.mp3 plays correctly and contains the full sentence in a single
natural voice. Report the time-to-first-audio-chunk. Show me the script and the output logs.
```

---

### PROMPT B2.1 — Conectar Claude → ElevenLabs

```
Now build the core chain. Create a new streaming route at
app/api/conversation/stream-premium/route.ts (or extend /stream with a premium branch —
propose whichever is cleaner and explain your choice).

Flow:
1. Auth + db user as usual. Then check isPremiumUser(userId). If false, return 403 with
   a message telling the client to fall back to the free flow.
2. Validate body, load session, append user turn (same as Phase A A1.2).
3. Open an ElevenLabs stream via createElevenLabsStream.
4. Start the Claude stream (stream: true).
5. As each text delta arrives from Claude:
   - enqueue it to the client as an SSE "text" event (so text appears on screen)
   - AND forward it to the ElevenLabs stream via sendText(delta)
   Buffer Claude deltas into word-ish chunks before sending to ElevenLabs (sending every
   tiny token individually is inefficient — accumulate until whitespace or ~20 chars).
6. As ElevenLabs returns audio chunks, enqueue them to the client as SSE "audio" events
   (base64-encoded) — interleaved with the text events in the same stream.
7. When Claude finishes, call elevenlabs.finish(). When ElevenLabs closes, send the "done" event.
8. Save the assistant turn async (post-response) and completeConversationSession if last turn.

On any ElevenLabs error mid-stream, send an SSE event {"type":"audio_failed"} so the client
can fall back to browser voice, but keep streaming the text normally.

Show me the route and explain the buffering strategy for Claude→ElevenLabs.
```

---

### PROMPT B2.2 — Multiplexar texto y audio al cliente

```
Refine the premium stream's SSE event protocol so the client can cleanly separate text
and audio. Use these event types:

  {"type":"text","delta":"..."}                      // text token(s) for display
  {"type":"audio","chunk":"<base64>","seq":<n>}      // audio chunk, sequence-numbered
  {"type":"timing","chars":[...],"startMs":<n>}      // optional char alignment for sync
  {"type":"audio_failed"}                            // ElevenLabs died, fall back
  {"type":"done","fullText":"...","isComplete":<bool>,"completedTurns":<n>,"targetTurns":<n>}
  {"type":"error","message":"..."}

Sequence-number the audio chunks (seq) so the client can play them in order even if
events arrive slightly out of order.

Show me the updated event-emitting code.
```

---

### PROMPT B2.3 — Timestamps de caracteres para sincronización

```
Pass through ElevenLabs' character alignment data so the frontend can coordinate text
appearance with audio playback.

When createElevenLabsStream's onCharTimings fires, transform the alignment into a simple
structure: an array of { char, startMs, durationMs } relative to the start of the audio,
and emit it as a "timing" SSE event.

If alignment data isn't available for a chunk, skip the timing event (the client will
fall back to a time-based approximation). Keep it resilient.

Show me the transformation and emission code.
```

---

### PROMPT B3.1 — Cola de reproducción de audio chunked

```
On the frontend, create lib/conversation/audio-queue.ts — an audio chunk player that
plays streamed MP3 chunks in order with no gaps.

Export createAudioQueue() returning:
  {
    enqueue: (base64Chunk: string, seq: number) => void,
    start: () => void,
    stop: () => void,
    onEnded: (cb: () => void) => void,
    isPlaying: () => boolean,
  }

Implementation approach: use MediaSource Extensions (MSE) with a SourceBuffer for
'audio/mpeg', appending chunks as they arrive. If MSE with mpeg isn't reliable across
target browsers, fall back to decoding each chunk with the Web Audio API
(AudioContext.decodeAudioData) and scheduling them back-to-back on the audio context clock.

Choose whichever you can make gapless and explain the choice. Handle out-of-order seq by
buffering until the next expected chunk is available.

Show me the completed file.
```

---

### PROMPT B3.2 — Coordinar texto con audio (karaoke aproximado)

```
Create a premium voice player that coordinates text reveal with audio playback, using
the audio queue and (when available) the character timings.

The goal is "good enough" karaoke: text appears roughly in sync with the spoken audio,
giving a sense of coordination. It does NOT need to be perfect per-character timing.

Create lib/conversation/premium-voice.ts implementing the same VoicePlayer-style interface
used in Phase A (so it's swappable), plus a way to feed it streamed audio chunks and
timing data.

Behavior:
- As audio plays, reveal the text progressively.
- If timing events are available, use them to gate which characters are shown by the
  current audio playback position.
- If no timing data, approximate: reveal text at a steady rate calibrated to the audio's
  total duration (or a words-per-second estimate) so text and voice finish around the same time.
- Expose the current revealed text so ConversationView can render it.

Show me the file and explain the fallback timing math.
```

---

### PROMPT B3.3 — Degradación elegante

```
Make the premium flow degrade gracefully when audio fails.

In the premium conversation view logic:
- If the stream sends "audio_failed", or if the audio queue errors, OR if no audio chunk
  arrives within ~2 seconds of text starting, abandon premium audio for that turn and
  speak the (already-streaming) text with the browser voice player from Phase A instead.
- The text streaming on screen must continue uninterrupted regardless.
- Log the fallback so we can monitor ElevenLabs reliability.

This ensures a premium user never gets a broken/silent turn. Show me the fallback logic.
```

---

### PROMPT B3.4 — Integrar en ConversationView

```
Update ConversationView to use the premium flow for premium users and the Phase A free
flow for everyone else.

- Detect the user's tier (passed as a prop from the server component, derived from
  isPremiumUser).
- Premium: use /api/conversation/stream-premium, the audio queue, and premium-voice
  (coordinated text + ElevenLabs audio).
- Free: use the Phase A flow unchanged (browser voice).
- Both share the same transcript UI, mic capture, progress, and completion screen.

Keep the branching clean — ideally the difference is just which VoicePlayer and which
endpoint are used. Show me the integrated component.
```

---

### PROMPT B4.1 — Cache de frases comunes

```
Implement an audio cache for common phrases to cut ElevenLabs costs.

Create lib/conversation/phrase-cache.ts:
- A curated list of ~30-50 common Alex phrases per scenario (greetings, encouragers like
  "That's interesting, tell me more!", closings).
- A function getCachedAudio(text, voiceId) that checks storage (use the project's storage —
  Supabase Storage or Upstash) for a pre-generated audio file keyed by a hash of text+voiceId.
- A function cacheAudio(text, voiceId, audioBuffer) that stores it.
- A script scripts/pregenerate-phrases.ts that generates and caches audio for all common
  phrases up front.

In the premium stream route, before sending text to ElevenLabs, check if the full
response (or its opening) matches a cached phrase and serve the cached audio instead.
(Keep this simple — exact-match cache first; fuzzy matching is a later optimization.)

Show me the cache module and explain the storage backend you chose.
```

---

### PROMPT B4.2 — Medición de caracteres para billing

```
Track ElevenLabs character usage per session for cost monitoring and credit deduction.

- Add a column to conversation_sessions (or a related usage table) to accumulate
  charactersUsed for the session.
- In the premium stream route, count characters sent to ElevenLabs (minus cached hits)
  and increment the session's charactersUsed.
- Expose a simple query getUserMonthlyCharacterUsage(userId) for future billing/limits.

Show me the schema change and the tracking code. Remind me to run the migration.
```

---

### PROMPT B5.1 — TypeScript check

```
Run npx tsc --noEmit and fix all type errors from the premium implementation.
Watch for: WebSocket types, MediaSource/AudioContext types (may need lib.dom updates),
Buffer vs Uint8Array in the audio path, and the SSE event union types.
Run until 0 errors. Show me the output.
```

---

### PROMPT B5.2 — Test del flujo premium + degradación

```
Start the dev server. Guide me through testing the premium experience (I'll use a
premium test account):

1. Start a session as a premium user.
2. Confirm Alex's audio is the ElevenLabs voice (natural, not the robotic browser voice).
3. Confirm there is NO voice change mid-sentence — one consistent voice throughout.
4. Confirm the text appears roughly in sync with the spoken audio.
5. Measure time-to-first-audio. It should feel responsive (~under 1 second).
6. Have a full multi-turn conversation and confirm each turn streams audio cleanly.

Then test degradation:
7. Temporarily set an invalid ELEVENLABS_API_KEY and confirm the flow falls back to the
   browser voice without breaking — text still streams, conversation still works.
8. Restore the key.

Also confirm a FREE user still gets the Phase A browser-voice flow.

Report latency numbers and any audio glitches (gaps, overlaps, out-of-order). Fix before
marking complete.
```

---

## NOTAS IMPORTANTES

- **Orden de construcción:** B1 (piezas aisladas) → B2 (chain backend) → B3 (audio frontend)
  → B4 (costos) → B5 (test). No saltar a B2 sin que B1.3 (test aislado de ElevenLabs) pase.
- **El test aislado B1.3 es crítico.** Confirma que ElevenLabs streaming anda antes de
  encadenarlo con Claude. Si esto falla, no tiene sentido seguir.
- **MSE vs Web Audio API (B3.1):** dejá que Codex elija según lo que pueda hacer gapless.
  Es la parte más delicada técnicamente. Si da problemas, pedile que pruebe ambos approaches.
- **Costos:** con el cache de frases (B4.1) más el gating premium, los costos de ElevenLabs
  quedan controlados — solo usuarios que pagan generan ese costo, y las frases repetidas
  no se regeneran.

---

## BLOQUE B6 — OPCIONAL: Redis (hacer DESPUÉS de terminar la Fase B)

No empieces esto hasta que toda la Fase B esté funcionando y testeada, y solo cuando
empieces a tener varios usuarios concurrentes. Gracias a la capa centralizada del B0.1,
sumar Redis acá toca SOLO lib/conversation/session-state.ts y agrega rate limiting —
nada más del código cambia.

### Checklist B6
- [ ] B6.1 Estado vivo de la sesión en Redis durante la conversación
- [ ] B6.2 Rate limiting de caracteres de ElevenLabs en tiempo real con Redis
- [ ] B6.3 Sincronización Redis → Postgres al terminar la sesión

---

### PROMPT B6.1 — Estado vivo en Redis

```
Now that the product is stable and we have concurrent users, move the hot-path session
state to Upstash Redis (already configured in the base template).

Edit ONLY lib/conversation/session-state.ts (the centralized layer from B0.1):
- getSessionState / saveUserTurn / saveAssistantTurn / getSessionProgress should now
  read and write the live session from Redis during an active conversation, using a key
  like fluent:session:{sessionId}. Set a TTL of a few hours.
- Postgres remains the permanent store — but during the active conversation, Redis is the
  fast working copy. Writes go to Redis immediately; we sync to Postgres on completion (B6.3).
- If a session isn't in Redis (e.g. expired or server restart), fall back to loading from
  Postgres and rehydrate Redis.

Do NOT change any caller. The whole point of B0.1 is that this is an internal swap.
Show me the updated file and confirm no other files changed.
```

---

### PROMPT B6.2 — Rate limiting de caracteres con Redis

```
Add real-time ElevenLabs character usage limiting using Redis.

Create lib/billing/character-limit.ts:
- A function checkAndReserveCharacters(userId, charCount) that increments a Redis counter
  fluent:chars:{userId}:{YYYY-MM} and returns whether the user is within their monthly
  premium quota. Use atomic INCR so concurrent turns don't race.
- A function getMonthlyUsage(userId) reading that counter.
- Define the monthly quota per premium tier (a constant for now).

In the premium stream route, before sending text to ElevenLabs, call
checkAndReserveCharacters. If over quota, fall back to the browser voice (reuse the B3.3
degradation path) and notify the client the premium quota is reached.

Show me the module and where you hooked it into the stream route.
```

---

### PROMPT B6.3 — Sincronización Redis → Postgres

```
Ensure the live Redis session syncs to Postgres permanently when the conversation ends.

In session-state.ts, markSessionComplete should:
1. Read the full session state from Redis.
2. Write the consolidated transcript and final turns to Postgres (the permanent record).
3. Update status to "completed".
4. Optionally delete or let the Redis key expire via its TTL.

Also add a safety net: an Inngest scheduled job (the template already has Inngest) that
periodically flushes any "active" Redis sessions older than N hours to Postgres, in case
a session was abandoned without hitting markSessionComplete.

Show me the updated markSessionComplete and the Inngest job. Remind me to register the job.
```

---

### NOTA SOBRE B6

El valor de haber hecho B0.1 se cobra acá: estos tres prompts no tocan ningún route handler,
ningún componente, ningún hook. Toda la lógica de streaming, audio y UI que construiste en
B1–B5 sigue igual. Redis entra por debajo, en la capa que ya habías centralizado. Eso es
exactamente por qué conviene dejar la abstracción lista desde el principio aunque no uses
Redis todavía.

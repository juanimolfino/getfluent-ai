# Deepgram Flux STT

Internal notes for Fluent premium voice input.

## Status

Deepgram Flux is implemented as premium speech-to-text input only. Free users continue using browser `SpeechRecognition`.

Current flow:

```text
Premium user taps Answer
-> browser starts local mic capture immediately
-> browser requests /api/stt/deepgram-token with sessionId
-> server validates Supabase Auth, premium status, session ownership, Origin, and rate limit
-> server returns a temporary Deepgram token and Flux WebSocket URL
-> browser connects directly to Deepgram with Sec-WebSocket-Protocol ["bearer", accessToken]
-> Deepgram Update events update visible transcript only
-> Deepgram EndOfTurn starts a local 2.2s grace window
-> if no new Update arrives, final transcript is sent into the existing conversation flow
-> Claude + ElevenLabs premium response flow remains unchanged
```

There is no WebSocket proxy in Vercel. Vercel only issues the temporary token.

## Env Vars

Server-only:

```env
DEEPGRAM_API_KEY=
DEEPGRAM_TEMP_TOKEN_TTL_SECONDS=30
DEEPGRAM_FLUX_MODEL=flux-general-en
DEEPGRAM_FLUX_EOT_THRESHOLD=0.9
DEEPGRAM_FLUX_EOT_TIMEOUT_MS=10000
DEEPGRAM_TOKEN_GRANT_RATE_LIMIT_WINDOW_SECONDS=60
DEEPGRAM_TOKEN_GRANTS_PER_USER_PER_WINDOW=12
DEEPGRAM_TOKEN_GRANTS_PER_SESSION_PER_WINDOW=8
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Public feature flag:

```env
NEXT_PUBLIC_PREMIUM_STT_PROVIDER=browser
NEXT_PUBLIC_STT_DEBUG_LOGS=false
STT_DEBUG_LOGS=false
```

Set `NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux` to enable premium Deepgram input. Set it back to `browser` for rollback.

Set `NEXT_PUBLIC_STT_DEBUG_LOGS=true` only when debugging raw Deepgram `TurnInfo` confidence updates in the browser console. Set `STT_DEBUG_LOGS=true` only when debugging every STT metrics event in the server terminal.

Notes:

- `DEEPGRAM_API_KEY` must be server-side only. Never prefix it with `NEXT_PUBLIC_`.
- The Deepgram API key must have permission to create temporary tokens. In Deepgram dashboard, a Member-role key worked for token grants.
- Public env vars are compiled into the browser bundle. Redeploy after changing `NEXT_PUBLIC_PREMIUM_STT_PROVIDER`.
- Upstash Redis is required for real server-side token grant rate limiting in Vercel.

## Database

Prompt 5 added:

```text
conversation_sessions.stt_audio_ms_used integer default 0 not null
```

Run:

```bash
npm run db:migrate
```

This column tracks estimated premium STT audio usage per session. It does not store audio or transcripts.

## Security

Implemented:

- `/api/stt/deepgram-token` accepts `POST`; `GET` returns `405`.
- Supabase Auth is required.
- Premium subscription is required.
- If `sessionId` is provided, the session must belong to the user and be active.
- `Origin` is validated for token and metrics POST routes.
- Deepgram API key is never returned to the client.
- Temporary token is not logged.
- Temporary token is not placed in the WebSocket URL.
- Browser connects to Deepgram with `["bearer", accessToken]`.
- Token grants are rate limited with Upstash Redis.
- Client closes `MediaRecorder`, mic tracks, and WebSocket on stop, cancel, unmount, and fallback.
- Client has a 60s max premium STT turn guard.
- There is no automatic reconnect loop.

If Upstash is not configured, rate limit is not enforced. This is acceptable for local development only.

## Fallback

Fallback target is the current browser voice input.

Fallback triggers include:

- token endpoint failure
- token endpoint 401, 403, 429, or 5xx
- unsupported `MediaRecorder` or Opus container
- microphone unavailable
- WebSocket error
- WebSocket close before final transcript
- Deepgram start failure

The UI shows:

```text
Using browser voice input for this turn.
```

The practice should continue without blocking.

## Metrics

Client emits batched events to `/api/stt/metrics`. Logging is fire-and-forget and should not block the conversation.

Events:

- `stt_provider_selected`
- `deepgram_token_requested`
- `deepgram_token_granted`
- `deepgram_ws_open`
- `deepgram_ws_close`
- `deepgram_ws_error`
- `deepgram_turn_start`
- `deepgram_turn_update_first`
- `deepgram_end_of_turn`
- `stt_fallback_to_browser`

Stored usage:

- `stt_audio_ms_used` increments only on `deepgram_end_of_turn`.

Logged fields include:

- sessionId
- userId
- provider
- model
- selectedByFlag
- fallback reason
- audioMs
- transcriptChars
- confidence
- tokenFetchMs
- wsOpenMs
- firstUpdateLatencyMs
- endOfTurnLatencyMs
- postSpeechSilenceMs
- eotToSubmitMs
- mediaRecorderMimeType
- normalized errorCode

Never log:

- raw audio
- blobs
- base64 audio
- accessToken
- API key
- raw transcript

## End-to-End Latency Test

The main perceived-latency metric is:

```text
[latency-roundtrip] turn sessionId=... sttEndSource=deepgram_eot sttEndToAudioMs=... sttToRequest=... requestToBackendReady=... requestToTtft=... ttftToAudio=... requestToAudioChunk=... audioChunkToVoice=...
```

This is logged in the browser console once per premium Deepgram turn when Alex's first audio actually starts playing.

Field meanings:

- `sttEndSource`: `deepgram_eot` when Deepgram confirmed the turn end; `manual_send` when the user pressed Send before Deepgram confirmed EOT.
- `sttEndToAudioMs`: Deepgram `EndOfTurn` received -> first audible Alex voice. This is the main user-perceived latency.
- `sttToRequest`: Deepgram `EndOfTurn` received -> `/api/conversation/stream-premium` request sent. This includes the 2.2s local grace window.
- `requestToBackendReady`: request received -> backend prompt/history ready. This covers auth, premium gating, session/profile load, and prompt construction.
- `requestToTtft`: request sent -> first Claude text event received by the browser.
- `requestToAudioChunk`: request sent -> first ElevenLabs audio chunk received by the browser.
- `ttftToAudio`: first Claude text event -> first audible Alex voice.
- `audioChunkToVoice`: first audio chunk received -> first audible Alex voice.

Development overlay:

- In `NODE_ENV=development`, the conversation view shows the latest roundtrip metric on screen.
- The overlay is never shown in production.

Three-turn manual test:

1. Set `NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux` and restart the dev server if needed.
2. Start a new premium practice session with 3 or more user turns.
3. For each turn, tap Answer, speak naturally, pause until the transcript submits, then wait until Alex starts speaking.
4. Capture one `[latency-roundtrip]` line per turn from the browser console.
5. Capture one `[stt-summary]` line per turn from the browser console.
6. Compare it with terminal logs from `[stt-metric]`, `[perf]`, `[latency] premium-turn`, and `[usage]`.

Deepgram turn summary:

```text
[stt-summary] sessionId=... provider=deepgram_flux source=deepgram_eot model=... audioMs=... transcriptChars=... postSpeechSilenceMs=... eotToSubmitMs=... tokenFetchMs=... wsOpenMs=... firstUpdateLatencyMs=... eotConfidence=... endOfTurnLatencyMs=...
```

Summary field meanings:

- `endOfTurnLatencyMs`: turn start -> final transcript submission. This includes the whole speaking time, pauses, token/WS startup, and final waiting. It is not "time after the user stopped speaking".
- `postSpeechSilenceMs`: last observed transcript change -> Deepgram `EndOfTurn`. This approximates the dead time after the last detected speech/content.
- `eotToSubmitMs`: Deepgram `EndOfTurn` -> transcript submitted to the conversation flow. This should be close to the local 2.2s grace window unless the user manually sends.
- `tokenFetchMs`, `wsOpenMs`, `firstUpdateLatencyMs`: startup and first transcript timing.
- `eotConfidence`: final Deepgram confidence at `EndOfTurn`.

Raw per-update Deepgram confidence logs are disabled by default. Enable `NEXT_PUBLIC_STT_DEBUG_LOGS=true` locally if you need `[stt-debug]` lines for every `TurnInfo` update. Server-side intermediate STT metric logs are also quiet by default; enable `STT_DEBUG_LOGS=true` if you need every `[stt-metric]` event.

What to inspect when something feels slow:

- High `postSpeechSilenceMs`: Deepgram is taking too long to decide the user has stopped speaking. Tune EOT only after checking early-cutoff risk.
- High `eotToSubmitMs`: local grace window or client-side submit delay.
- High `sttToRequest`: Deepgram `EndOfTurn` -> stream request. It should mostly equal `eotToSubmitMs` for `sttEndSource=deepgram_eot`.
- High `requestToBackendReady`: auth, premium check, session load, language profile load, or DB/network latency. Check `[perf] step=...`.
- High `requestToTtft`: Claude/model latency, prompt size, message history size, or request setup.
- High `requestToAudioChunk` with normal TTFT: ElevenLabs WebSocket/TTS latency or chunk buffering.
- High `audioChunkToVoice`: browser playback queue, MSE/Web Audio startup, or premium audio player scheduling.
- High `firstUpdateLatencyMs` in `[stt-summary]`: Deepgram token/WS readiness, audio buffering, network, or MediaRecorder behavior.

## Tuning

Current production-oriented defaults:

```env
DEEPGRAM_FLUX_MODEL=flux-general-en
DEEPGRAM_FLUX_EOT_THRESHOLD=0.9
DEEPGRAM_FLUX_EOT_TIMEOUT_MS=10000
```

These are more patient than the initial MVP defaults because real testing showed occasional early cutoffs during learner pauses.

How EOT settings interact:

- `DEEPGRAM_FLUX_EOT_THRESHOLD` is the confidence Deepgram must reach before it emits final `EndOfTurn`. Higher is safer against cutting learners off, but can wait longer.
- `DEEPGRAM_FLUX_EOT_TIMEOUT_MS` is the maximum EOT patience window used by the Flux request. Higher gives learners more room for pauses, but can increase dead time.
- The app then adds a local `DEEPGRAM_FINAL_SEND_GRACE_MS=2200` grace window after Deepgram `EndOfTurn`; a new transcript update cancels that send.

Do not set `eager_eot_threshold` in the MVP.

Adjustment guide:

- Cuts too early: raise `DEEPGRAM_FLUX_EOT_THRESHOLD` toward `0.9` or raise `DEEPGRAM_FLUX_EOT_TIMEOUT_MS` toward `10000`.
- Takes too long to send after the user finishes: lower threshold or timeout.
- First visible text feels late: measure `tokenFetchMs`, `wsOpenMs`, and `firstUpdateLatencyMs`. Local dev can be slower because Supabase, Upstash, and Deepgram calls are all remote.

Observed local performance notes:

- Deepgram token request can take multiple seconds locally.
- The browser now captures audio immediately and buffers chunks while token and WebSocket connect.
- Metrics POSTs can take around 2s locally because they validate auth/session and hit DB/Redis, but they are batched and fire-and-forget.
- Do not optimize further until measuring after Vercel deploy near Supabase and Upstash.

Potential later optimizations:

- prefetch token when entering a premium conversation
- reduce auth/session work in metrics route
- sample non-critical metrics
- cache premium/session validation briefly server-side

## QA Checklist

Manual coverage:

- Chrome desktop premium with `deepgram_flux`
- Safari desktop premium with `deepgram_flux`
- Chrome Android if supported
- Safari iOS if supported
- free user with default browser STT
- premium user with `NEXT_PUBLIC_PREMIUM_STT_PROVIDER=browser`
- premium user with `NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux`
- Deepgram API key absent
- Deepgram API key invalid
- Deepgram key without token grant permissions
- mic permission denied
- background noise
- user pauses for several seconds mid-answer
- user with strong accent
- user leaves mic open for more than 60s
- network drop while WebSocket is open
- browser navigation during listening
- End conversation manual
- final configured turn is the only natural goodbye
- analysis screen loads

Expected checks:

- free flow remains unchanged
- premium flag browser remains unchanged
- premium flag Deepgram transcribes and sends turns
- no duplicate user turns
- no raw transcript in STT metrics logs
- no token/API key/audio in logs
- no Deepgram token in browser URL
- fallback returns to browser input
- `/api/stt/deepgram-token` returns 403 for free users
- `/api/stt/deepgram-token` returns 429 after configured grant limit

## Acceptance Metrics

Initial internal acceptance:

- free voice input has no regression
- premium Deepgram sends a complete user turn in Chrome desktop
- fallback rate under 10% in internal testing
- duplicate STT-submitted turns: 0
- token/API key/audio leak findings: 0
- `npx tsc --noEmit` passes
- `npm test` passes
- `npm run build` passes

## Rollout

Recommended rollout:

1. Local dev with one premium account.
2. Vercel preview with one internal premium account.
3. Production beta with 1-2 premium accounts.
4. Enable for all premium only after fallback rate and early-cutoff reports are acceptable.

Current app uses a global public feature flag, not percentage rollout. For a real 10% rollout, add a server-side or user-level rollout mechanism before enabling broadly.

## Rollback

Fast rollback:

```env
NEXT_PUBLIC_PREMIUM_STT_PROVIDER=browser
```

Then redeploy, because `NEXT_PUBLIC_*` is compiled into the browser bundle.

If Deepgram causes server-side issues, also remove or rotate `DEEPGRAM_API_KEY` in Vercel after disabling the public flag.

## Future Work

Do not implement these in the MVP:

- Flux multilingual: `flux-general-multi` with language hints
- `EagerEndOfTurn` for lower latency
- AudioWorklet + Linear16 16k mono if MediaRecorder/WebM is poor on Safari/iOS
- keyterm prompting by conversation topic
- UI to edit transcript before sending
- separate pronunciation scoring product

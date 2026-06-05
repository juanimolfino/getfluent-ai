Fluent es una app Next.js 16 + TS + App Router.
  Free input usa SpeechRecognition del navegador.
  Premium input puede usar Deepgram Flux si
  NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux.
  El browser pide /api/stt/deepgram-token, valida auth/premium/
  session/origin/rate limit, y se conecta directo a Deepgram
  con token temporal.
  No hay proxy WS en Vercel.
  La respuesta premium con Claude + ElevenLabs no cambió.
  Se agregaron métricas STT en /api/stt/metrics, uso en
  conversation_sessions.stt_audio_ms_used, y logs [perf]/
  [latency]/[stt-metric]/[stt-usage].
  Pendiente: correr npm run db:migrate.
  Docs: docs/deepgram-flux-stt.md y docs/MANUAL_ACTIONS.md.


  Seguimos con Fluent. Ya está implementado y documentado
  Deepgram Flux para premium STT, con fallback al navegador,
  métricas y rate limiting.

  Quiero que retomemos desde el estado actual del repo sin
  rehacer lo ya hecho. Empezá leyendo la documentación interna
  relevante y el código existente para entender el flujo actual
  antes de tocar nada. Después, te voy a ir pasando el
  siguiente objetivo concreto.
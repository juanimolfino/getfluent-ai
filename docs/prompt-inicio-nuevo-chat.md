Fluent es una app Next.js 16 + TS + App Router.

Estado actual importante:
- URL oficial de producción: `https://www.aigetfluent.com`; apex redirige a `www`.
- Supabase Auth con Google funciona en producción.
- Stripe Checkout usa 3 suscripciones y 3 packs. Checkout reutiliza `users.stripeCustomerId`; si falta, crea Stripe Customer y lo guarda antes de crear la sesión.
- Stripe webhook requerido: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.
- `invoice.paid` ya soporta la forma nueva de Stripe donde la suscripción puede venir en `invoice.parent.subscription_details.subscription`, y resuelve usuario por metadata, `stripeSubscriptionId` o `stripeCustomerId`.
- Billing Portal usa `POST /api/stripe/portal`; requiere usuario logueado con `stripeCustomerId`; devuelve `{ url }`; frontend redirige con `window.location.href`.
- Stripe Customer Portal debe configurarse manualmente en Stripe Dashboard > Billing > Customer portal.
- Producción necesita `NEXT_PUBLIC_APP_URL=https://www.aigetfluent.com`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y los `STRIPE_PRICE_ID_*`.

Voz/STT:
- Premium input puede usar Deepgram Flux si `NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux`.
- Browser pide `/api/stt/deepgram-token`, valida auth/sesión/rate limit, y se conecta directo a Deepgram con token temporal. No hay proxy WS en Vercel.
- Conversation prefetches Deepgram token; `SpeakExercise` también prefetches token y arranca la grabación sin esperar el request, para sentirse inmediato.
- Métricas STT: `/api/stt/metrics`, `conversation_sessions.stt_audio_ms_used`, logs `[perf]`, `[latency]`, `[stt-metric]`, `[stt-usage]`.

Práctica generada:
- `ExerciseSetView` cachea exercise sets y persiste progreso en `localStorage` por `analysisId:weakPointId`, para que refrescar en un ejercicio intermedio vuelva al mismo ejercicio.

Docs relevantes:
- `CONTEXT.md`
- `docs/MANUAL_ACTIONS.md`
- `docs/deepgram-flux-stt.md`
- `claudeprompts/FASE-STRIPE-PROGRESO.md`

Seguimos con Fluent. Retomá desde el estado actual del repo sin rehacer lo ya hecho. Primero leé la documentación interna relevante y el código existente para entender el flujo actual antes de tocar nada. Después seguí el objetivo concreto que se pida.

# Fase Stripe - Progreso

## 2026-06-09 - S0.1 Inventario

Estado inicial encontrado:
- Stripe client, checkout, portal y webhook ya existian desde el template.
- Webhook valida firma con `STRIPE_WEBHOOK_SECRET`.
- Tablas existentes: `credits`, `subscriptions`, `transactions`.
- Modelo viejo: `credits.balance` unico, un solo plan Pro, packs hardcodeados y creditos desde env/session metadata.
- Conversaciones Fluent aun no consumen creditos. Eso queda para S2.

## 2026-06-09 - S0.2 + S1.1 + S1.2 + S1.3

Cambios realizados:
- S0.2: reconfirmada estructura de keys y webhook. No se cambio la firma del webhook.
- S1.1: `lib/stripe/pricing.ts` ya no hardcodea cantidades/precios; define productos y lee `credits` + `type` desde metadata del Stripe Price.
- S1.2: `credits.balance` se reemplaza por `credits_subscription` y `credits_pack`.
- S1.2: migracion `drizzle/0008_split_credit_balances.sql` mueve saldos existentes a `credits_pack`.
- S1.2: helpers de DB ahora calculan saldo total y mantienen jobs funcionando con descuento subscription-first, pack-second.
- S1.3: los 5 creditos free de signup siguen otorgandose una sola vez, ahora en `credits_pack`.

Pendiente:
- No se toco el descuento de creditos al iniciar conversacion. Eso queda aislado para S2.
- No se elimino aun todo gating premium por suscripcion en endpoints de voz/STT. Debe revisarse cuando se active "siempre premium".
- Requiere `npm run db:migrate` para aplicar la migracion del saldo separado.

## 2026-06-09 - S2 descuento atomico + siempre premium

Cambios realizados:
- `/api/conversation/start` ahora crea la sesion con `creditsUsed=1` y descuenta 1 credito en la misma transaccion DB.
- El descuento bloquea la fila de `credits` con `FOR UPDATE`, consume primero `credits_subscription` y luego `credits_pack`.
- Si no hay saldo, devuelve `402` y no crea sesion.
- Se registra una transaccion `credit_spend` con `sessionId` y desglose del debito.
- Los endpoints caros pasan de gatear por suscripcion a validar sesion propia con `creditsUsed >= 1`.
- Las paginas bajo `/practice/[sessionId]` tratan toda sesion pagada como experiencia completa (`isPremium=true`).
- `Deepgram` para ejercicios hablados ahora recibe `sessionId`, para no romper el acceso con la nueva validacion.
- El fallback tecnico de ElevenLabs/browser voice no fue modificado.

Pendiente:
- Browser confirmado: al iniciar conversacion el saldo baja 1 y solo 1.
- Browser confirmado: sin creditos no se crea conversacion.
- Browser confirmado: ElevenLabs funciona en sesiones pagadas.
- Cuando se agregue el sistema de compra UI, manejar el `402` para llevar a compra de creditos.

## 2026-06-09 - S2 ajustes post-test

Cambios realizados:
- El error `402` de `/api/conversation/start` ahora muestra en la UI un mensaje accionable: comprar creditos para seguir practicando.
- La UI de settings muestra CTA a `/pricing` cuando el usuario se queda sin creditos.
- `AnalysisView` cachea analisis por `sessionId` y reutiliza requests en vuelo para evitar doble POST desde el browser.
- `ExerciseSetView` cachea exercise sets por `analysisId:weakPointId` y reutiliza requests en vuelo para evitar regeneraciones duplicadas.
- El backend mantiene cache DB: si ya existe analisis o exercise set, devuelve lo guardado antes de gastar Claude.

Pendiente:
- En una etapa posterior conviene agregar constraints unicos DB para blindar duplicados concurrentes multi-tab: `conversation_analyses(session_id,user_id)` y `exercise_sets(analysis_id,weak_point_id,user_id)`.

## 2026-06-09 - Decision audio de conversaciones

Decision:
- No guardar audios por turno de conversacion todavia.
- El replay de audio premium queda en memoria del browser durante la sesion.
- No se persiste audio en Supabase Storage hasta tener cleanup automatico de objetos con mas de 60 dias.

Motivo:
- Evita crecimiento ilimitado de Storage.
- Mantiene la postura de privacidad: no guardar audio crudo de usuario ni blobs por defecto.

## 2026-06-09 - S3 checkout + webhook

Cambios realizados:
- S3.1: checkout de suscripcion usa Stripe Checkout `mode=subscription`, usuario autenticado server-side y Price metadata validada.
- S3.2: checkout de packs usa Stripe Checkout `mode=payment`, usuario autenticado server-side y Price metadata validada.
- S3.3: webhook firmado otorga creditos solo desde Stripe:
  - `checkout.session.completed` con `kind=pack` suma a `credits_pack`.
  - `invoice.paid` resetea `credits_subscription`.
  - `customer.subscription.deleted` marca suscripcion cancelada.
- Idempotencia: se pasa `event.id` como `stripeEventId` a las transacciones, evitando doble otorgamiento.
- Checkout ahora valida Origin antes de auth/Stripe session creation.
- Documentados pasos manuales de Stripe TEST MODE y webhook local.

Pendiente:
- Probar con Stripe CLI en local y tarjetas de test.

## 2026-06-22 - Produccion aigetfluent + portal + invoice.paid

Cambios y verificaciones:
- URL oficial: `https://www.aigetfluent.com`.
- Webhook de produccion esperado: `https://www.aigetfluent.com/api/stripe/webhook`.
- Eventos necesarios en Stripe: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.
- Compra real de suscripcion verificada en Stripe live: `checkout.session.completed` e `invoice.paid` llegaron con HTTP 200.
- Bug critico encontrado: con API Stripe nueva, `invoice.paid` no traia la subscription en `invoice.subscription`; venia en `invoice.parent.subscription_details.subscription`.
- Fix aplicado: webhook resuelve subscription id desde legacy `invoice.subscription`, `invoice.parent.subscription_details.subscription` y fallback por line items.
- Fix aplicado: `invoice.paid` resuelve user por `subscription.metadata.userId`, metadata de invoice, `stripeSubscriptionId` guardado o `stripeCustomerId` guardado.
- Fix aplicado: `checkout.session.completed` guarda `users.stripeCustomerId` cuando Stripe devuelve `session.customer`.
- Checkout ahora reutiliza `users.stripeCustomerId`; si falta, crea Stripe Customer y lo guarda antes del Checkout Session.
- Portal de billing usa `POST /api/stripe/portal`, requiere auth y `stripeCustomerId`; no crea customer si falta.
- Frontend Billing/Manage billing llama al endpoint, recibe `{ url }` y redirige a Stripe Billing Portal con `window.location.href`.
- El portal usa `return_url=${NEXT_PUBLIC_APP_URL}/dashboard`.
- Si Stripe Customer Portal no esta configurado en Dashboard > Billing > Customer portal, el endpoint devuelve error claro.

Tests agregados/corridos:
- Portal: usuario sin `stripeCustomerId` devuelve error claro; usuario con `stripeCustomerId` crea session; portal no configurado devuelve error claro.
- Boton frontend: POST a `/api/stripe/portal`, error humano, redireccion cuando hay URL.
- Checkout: crea customer si falta; reutiliza customer existente.
- Webhook: `invoice.paid` con forma nueva y resolucion por customer.

Pendiente operacional:
- Confirmar en Vercel produccion `NEXT_PUBLIC_APP_URL=https://www.aigetfluent.com`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y todos los `STRIPE_PRICE_ID_*`.
- Confirmar manualmente Stripe Billing Portal configurado en Stripe live.

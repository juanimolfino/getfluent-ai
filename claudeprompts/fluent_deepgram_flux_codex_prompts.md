# Prompts para Codex — Fluent: Deepgram Flux para input premium de voz

Fecha de preparación: 2026-06-02  
App: Fluent  
Objetivo: agregar **Deepgram Flux como STT streaming premium** para convertir la voz del usuario a texto en tiempo real. El plan free debe seguir usando `SpeechRecognition` del navegador como hoy.

---

## Resumen de la decisión técnica

Implementar Deepgram Flux **solo para el input de voz premium**:

```txt
Premium user habla
→ Browser captura micrófono
→ WebSocket directo a Deepgram Flux
→ transcript parcial/final
→ el texto final entra al flujo actual de conversación
→ Claude genera respuesta
→ ElevenLabs reproduce audio premium
```

El flujo free queda igual:

```txt
Free user habla
→ Web Speech API del navegador
→ flujo actual
```

Deepgram Flux se usa para **voice-to-text**, no para scoring de pronunciación. No hay que venderlo ni tratarlo internamente como “corrección de pronunciación”. El objetivo es tener una transcripción más confiable y consistente que `SpeechRecognition`, sobre todo para usuarios con acento o pronunciación imperfecta.

Importante: ningún STT garantiza transcripción “literal fonética”. Deepgram también decide la hipótesis más probable de palabras, pero debería ser más estable que el STT del navegador. Por eso hay que mostrar/usar el transcript con métricas de confianza y fallback, no asumir perfección.

---

## Fuentes técnicas verificadas

Usar estas referencias como contexto técnico al implementar:

- Deepgram Flux usa WebSocket `/v2/listen` con `model=flux-general-en`:  
  https://developers.deepgram.com/docs/flux/quickstart

- API reference Flux:  
  https://developers.deepgram.com/reference/speech-to-text/listen-flux

- Deepgram token temporal: `POST https://api.deepgram.com/v1/auth/grant`, devuelve `access_token` y `expires_in`:  
  https://developers.deepgram.com/reference/auth/tokens/grant

- Token-based auth para browser/client-side apps:  
  https://developers.deepgram.com/guides/fundamentals/token-based-authentication

- Autenticación WebSocket desde browser con `Sec-WebSocket-Protocol`:  
  https://developers.deepgram.com/docs/using-the-sec-websocket-protocol

- Migración Nova-3 → Flux: eventos `TurnInfo`, `StartOfTurn`, `Update`, `EndOfTurn`, audio mono y chunks recomendados de 80 ms:  
  https://developers.deepgram.com/docs/flux/nova-3-migration

- Vercel Functions no deben usarse como WebSocket server persistente. En esta integración, el browser se conecta directo a Deepgram y Vercel solo entrega token temporal:  
  https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections

---

## Reglas globales para todos los prompts

Estas reglas aplican a todos los pasos:

1. **No romper el free plan.** El input free sigue usando `SpeechRecognition` del navegador.
2. **No tocar de más `/api/conversation/stream-premium`.** Deepgram es input STT, no output TTS ni reemplazo del flujo premium actual.
3. **No proxyear audio por Vercel.** Vercel solo genera tokens temporales. El WebSocket de audio va directo desde browser a Deepgram.
4. **Nunca exponer `DEEPGRAM_API_KEY` al cliente.** Solo se entrega un token temporal de Deepgram al browser.
5. **Todo acceso al estado de sesión debe pasar por `lib/conversation/session-state.ts`.** No crear estado paralelo desordenado.
6. **No loguear audio crudo.** No guardar blobs, chunks ni tokens.
7. **No loguear transcript crudo salvo que el proyecto ya lo haga y esté aceptado por producto.** Para métricas, preferir longitud, timing, confidence, provider, errores y fallback reason.
8. **No llamar a Claude con transcripts parciales.** Para el MVP, mandar a Claude solo en `EndOfTurn`.
9. **No usar `EagerEndOfTurn` para arrancar Claude en la primera versión.** Puede aumentar llamadas LLM y complejidad. Dejarlo como mejora futura.
10. **Cada prompt debe terminar con STOP & TEST.** Codex debe detenerse y devolver resumen, archivos tocados, comandos corridos y resultados.

---

## Protocolo de ejecución para Codex

Cada vez que ejecutes uno de estos prompts en Codex, pedirle que respete este formato al terminar:

```txt
STOP & TEST

Resumen:
- ...

Archivos modificados:
- ...

Comandos ejecutados:
- ...

Resultado de tests/typecheck/build:
- ...

Pendientes/riesgos:
- ...

Qué probar manualmente ahora:
- ...
```

No avanzar al siguiente prompt hasta haber testeado lo pedido.

---

# PROMPT 0 — Auditoría del repo y plan de integración

Copiar y pegar en Codex:

```txt
Actúa como lead engineer de Fluent.

Contexto de la app:
- Next.js 16 con App Router
- TypeScript
- Supabase Auth
- Drizzle + Postgres
- Hosting en Vercel
- Free voice input usa Web Speech API: SpeechRecognition + speechSynthesis
- Premium output usa /api/conversation/stream-premium con Claude + ElevenLabs por WebSocket backend y SSE al cliente
- Todo acceso al estado de sesión pasa por lib/conversation/session-state.ts
- El objetivo ahora es agregar Deepgram Flux SOLO como input STT premium.
- Free debe seguir igual con SpeechRecognition del navegador.

Tu tarea en este paso es AUDITAR el repo, no implementar todavía.

Buscá e informá:
1. Dónde vive hoy el input de voz del usuario con SpeechRecognition.
2. Dónde se decide si un usuario es premium.
3. Cómo se valida Supabase Auth en /api/conversation/stream-premium.
4. Si ya existe helper reutilizable para premium gating.
5. Dónde se envía el texto del usuario al flujo de conversación.
6. Qué tests existen para conversación, sesión, premium gating y voz.
7. Qué archivos conviene tocar para agregar un provider nuevo de STT sin romper el free plan.
8. Si existe infraestructura de métricas/logging/billing que podamos reutilizar.

No implementes cambios todavía salvo que sean comentarios temporales, y preferentemente no modifiques archivos.

Proponé un plan concreto con:
- archivos a crear
- archivos a modificar
- riesgos
- tests a agregar
- checklist manual de QA

Reglas:
- No cambiar /api/conversation/stream-premium todavía.
- No crear WebSocket server en Vercel.
- No exponer ningún secreto al cliente.
- No tocar session state por fuera de lib/conversation/session-state.ts.

STOP & TEST: al finalizar, devolvé solo auditoría + plan. No implementes.
```

---

# PROMPT 1 — Configuración, feature flags y tipos base

Ejecutar después de revisar el plan del Prompt 0.

```txt
Implementá la base de configuración para Deepgram Flux sin activar todavía el flujo en UI.

Objetivo:
- Agregar feature flags, env vars, tipos compartidos y documentación mínima.
- No cambiar todavía el comportamiento runtime del usuario.

Env vars propuestas:
- DEEPGRAM_API_KEY: secreto server-only. Nunca usar NEXT_PUBLIC.
- DEEPGRAM_TEMP_TOKEN_TTL_SECONDS: opcional, default 30 o 60. Debe respetar límites de Deepgram.
- DEEPGRAM_FLUX_MODEL: opcional, default flux-general-en.
- DEEPGRAM_FLUX_EOT_THRESHOLD: opcional, default 0.8 para evitar cortes tempranos.
- DEEPGRAM_FLUX_EOT_TIMEOUT_MS: opcional, default 7000 para estudiantes que pausan.
- NEXT_PUBLIC_PREMIUM_STT_PROVIDER: browser | deepgram_flux. Default browser. Esto no es seguridad, solo selección de UI; la seguridad real va en el endpoint server.

Tareas:
1. Agregá o actualizá .env.example con las variables anteriores.
2. Creá un helper server-only para leer config de Deepgram, por ejemplo:
   - lib/deepgram/config.ts
   - o el path que mejor encaje con el repo.
3. Validá valores numéricos:
   - ttl debe estar en rango razonable. Deepgram permite ttl_seconds 1-3600; usar default corto.
   - eot_threshold debe estar entre 0.5 y 0.9.
   - eot_timeout_ms debe estar entre 500 y 10000.
4. Creá tipos base para input de voz, por ejemplo:

   type SpeechInputProvider = "browser_speech_recognition" | "deepgram_flux";

   type SttTurnMetadata = {
     provider: SpeechInputProvider;
     model?: string;
     transcriptChars: number;
     audioMs?: number;
     endOfTurnConfidence?: number;
     fallbackReason?: string;
   };

   Ajustá nombres y ubicación a la arquitectura real.

5. Si existe un archivo central de tipos de conversación, agregá los tipos ahí. Si no, crear uno chico y bien nombrado.
6. Agregá tests unitarios para parsing/validación de config si el repo ya testea helpers similares.

Reglas:
- No usar process.env en Client Components.
- No exponer DEEPGRAM_API_KEY.
- No conectar todavía con Deepgram.
- No cambiar el free flow.
- No cambiar /api/conversation/stream-premium.

Comandos a correr:
- npx tsc --noEmit
- npm run build si no tarda demasiado en el entorno
- npm test o npm run test si existe

STOP & TEST: devolvé resumen, archivos tocados, tests ejecutados y cualquier problema.
```

---

# PROMPT 2 — Endpoint server para token temporal Deepgram

Ejecutar solo después de que Prompt 1 compile.

```txt
Implementá un endpoint server para entregar tokens temporales de Deepgram a usuarios premium autenticados.

Objetivo:
Crear un route handler App Router, probablemente:
- app/api/stt/deepgram-token/route.ts

o el path equivalente que encaje mejor.

Este endpoint debe:
1. Aceptar solo POST.
2. Validar Supabase Auth igual que /api/conversation/stream-premium.
3. Validar premium gating reutilizando la lógica existente.
   - Si no existe helper central, extraer uno pequeño desde el gating actual sin cambiar comportamiento.
4. Rechazar usuarios no autenticados con 401.
5. Rechazar usuarios no premium con 403.
6. Rechazar si DEEPGRAM_API_KEY falta con 503 o error server controlado, sin filtrar detalles.
7. Llamar a Deepgram:

   POST https://api.deepgram.com/v1/auth/grant
   Headers:
     Authorization: Token <DEEPGRAM_API_KEY>
     Content-Type: application/json
   Body:
     { "ttl_seconds": <config ttl> }

8. Devolver JSON seguro al cliente:

   {
     "accessToken": "<temporary access_token>",
     "expiresIn": 30,
     "websocketUrl": "wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.8&eot_timeout_ms=7000",
     "model": "flux-general-en",
     "provider": "deepgram_flux"
   }

   Notas:
   - Construir websocketUrl con URLSearchParams.
   - Para el MVP, NO setear eager_eot_threshold.
   - Si el cliente va a mandar WebM/Opus containerizado, NO incluir encoding ni sample_rate.
   - Si más adelante se manda raw Linear16, ahí sí agregar encoding=linear16&sample_rate=16000.

9. Agregar headers:
   - Cache-Control: no-store
10. No guardar el token en DB ni logs.
11. Loguear solo eventos seguros si ya existe logger:
   - userId
   - provider
   - model
   - token grant success/failure
   - no token
   - no transcript
   - no audio

Tests requeridos:
1. 401 si no hay sesión.
2. 403 si usuario no premium.
3. 503/controlado si falta DEEPGRAM_API_KEY.
4. 502/controlado si Deepgram responde error.
5. 200 si Deepgram responde access_token.
6. El response no debe incluir DEEPGRAM_API_KEY.
7. Cache-Control debe ser no-store.

Mockear fetch a Deepgram en tests. No hacer llamadas reales.

Reglas:
- No crear WebSocket server en Vercel.
- No pasar audio por este endpoint.
- No exponer API key.
- No modificar UI todavía.
- No cambiar free plan.

Comandos:
- npx tsc --noEmit
- npm test o npm run test
- npm run build si corresponde

STOP & TEST: devolvé resumen, archivos tocados, tests y cómo probar manualmente con curl/fetch autenticado si aplica.
```

---

# PROMPT 3 — Provider cliente `DeepgramFluxSpeechProvider`

Ejecutar después de validar el endpoint de token.

```txt
Implementá un provider cliente para input de voz premium con Deepgram Flux, sin conectarlo todavía por default a todos los usuarios.

Objetivo:
Crear una abstracción de STT donde el provider actual de browser siga existiendo, y Deepgram sea un provider alternativo para premium.

Tareas:
1. Identificar el código actual que usa SpeechRecognition.
2. Extraer o adaptar una interfaz común, por ejemplo:

   interface SpeechToTextProvider {
     start(): Promise<void>;
     stop(): Promise<void> | void;
     cancel(): Promise<void> | void;
     isSupported(): boolean;
     onPartialTranscript?: (text: string) => void;
     onFinalTranscript?: (payload: FinalTranscriptPayload) => void;
     onError?: (error: SttProviderError) => void;
     onMetrics?: (metrics: SttProviderMetrics) => void;
   }

   Adaptá al estilo real del repo. No fuerces esta forma si ya hay una abstracción mejor.

3. Mantener el provider browser actual como default para free y fallback.
4. Crear `DeepgramFluxSpeechProvider` o nombre equivalente.
5. El provider Deepgram debe:
   - pedir token con POST /api/stt/deepgram-token
   - abrir WebSocket directo a `websocketUrl`
   - autenticar desde browser usando subprotocols de WebSocket:

     new WebSocket(websocketUrl, ["token", accessToken])

     Si el repo usa SDK oficial de Deepgram y es más robusto, justificarlo. Pero no exponer API key.

   - capturar micrófono con getUserMedia
   - enviar audio al WebSocket en chunks
   - recibir mensajes JSON tipo `TurnInfo`
   - usar `event: "Update"` para transcript parcial visible
   - usar `event: "EndOfTurn"` como transcript final del turno
   - ignorar transcripts vacíos
   - deduplicar por `turn_index` + transcript final para no mandar dos veces el mismo turno
   - cerrar mic tracks al finalizar
   - cerrar WebSocket al cancelar o terminar
   - enviar `{ "type": "CloseStream" }` antes de cerrar si corresponde y si el socket está abierto

6. Captura de audio MVP:
   - Preferir MediaRecorder con `audio/webm;codecs=opus` si está soportado.
   - Iniciar con timeslice de 80ms o el valor más cercano práctico.
   - Enviar cada Blob como ArrayBuffer binario al WebSocket cuando readyState sea OPEN.
   - Si `audio/webm;codecs=opus` no está soportado, probar `audio/ogg;codecs=opus` si el browser lo soporta.
   - Si no hay formato compatible, fallback automático al provider browser.

7. No incluir encoding/sample_rate en websocketUrl cuando el audio es containerizado WebM/Ogg Opus.
8. Agregar manejo de errores:
   - token endpoint 401/403 → fallback a browser si posible y reportar métrica
   - token endpoint 5xx → fallback a browser
   - WebSocket close/error antes de EndOfTurn → fallback o mostrar error recuperable
   - permiso mic denegado → usar manejo actual de mic denegado
   - MediaRecorder unsupported → fallback browser
   - Deepgram timeout/silencio largo → permitir stop manual

9. Agregar métricas en memoria/callback, no necesariamente persistidas todavía:
   - provider seleccionado
   - token fetch ms
   - ws open ms
   - first update latency ms
   - audio ms enviado estimado
   - turn_index
   - end_of_turn_confidence
   - transcript chars
   - fallback reason
   - mimeType usado

Tests:
1. Parser de mensajes TurnInfo:
   - Update actualiza parcial
   - EndOfTurn emite final
   - transcript vacío no emite final
   - turn_index repetido no duplica final
2. Fallback si token endpoint falla.
3. Fallback si MediaRecorder no está soportado.
4. No se loguea accessToken.

Reglas:
- No llamar a Claude desde Update.
- No implementar EagerEndOfTurn todavía.
- No romper SpeechRecognition actual.
- No guardar audio crudo.
- No usar DEEPGRAM_API_KEY en cliente.

Comandos:
- npx tsc --noEmit
- npm test o npm run test
- npm run build si corresponde

STOP & TEST: mostrar archivos, tests, y checklist manual para probar conexión Deepgram en local con usuario premium.
```

---

# PROMPT 4 — Conectar Deepgram solo para premium input de voz

Ejecutar después de probar manualmente el provider aislado.

```txt
Conectá el provider Deepgram Flux al flujo real de conversación premium, manteniendo free exactamente como está.

Objetivo:
- Si el usuario es premium y NEXT_PUBLIC_PREMIUM_STT_PROVIDER=deepgram_flux, usar Deepgram para input de voz.
- Si el usuario es free, usar SpeechRecognition como siempre.
- Si Deepgram falla, fallback elegante a SpeechRecognition del navegador.

Tareas:
1. Encontrar el componente/hook donde se inicia la escucha del usuario.
2. Seleccionar provider con esta lógica:

   if user is premium AND public flag is deepgram_flux:
     try DeepgramFluxSpeechProvider
   else:
     BrowserSpeechRecognitionProvider

   Importante: aunque el cliente crea que es premium, el endpoint /api/stt/deepgram-token debe seguir siendo la autoridad real.

3. Integrar `onPartialTranscript` en la UI existente:
   - mostrar texto parcial como “lo que Fluent está escuchando” si la UI ya tiene esa zona
   - no enviar parcial al backend

4. Integrar `onFinalTranscript`:
   - al recibir EndOfTurn con transcript no vacío, enviar ese texto al flujo actual del turno del usuario
   - respetar cantidad de turnos configurada
   - no alterar la lógica de despedida de Alex
   - no alterar End conversation manual

5. Deduplicación:
   - Evitar doble envío si el usuario aprieta stop al mismo tiempo que llega EndOfTurn.
   - Evitar doble envío si Deepgram reenvía un TurnInfo similar.

6. Barge-in / interrupción:
   - Si ya existe lógica para detener audio de Alex cuando el usuario empieza a hablar, conectar `StartOfTurn` a esa lógica.
   - Si no existe, no crear una re-arquitectura grande ahora. Solo dejar TODO medible.

7. Fallback:
   - Si falla token, WS, formato de audio o permiso, caer al provider browser.
   - Informar al usuario con mensaje corto si corresponde: “Using browser voice input for this turn.”
   - No bloquear la práctica.

8. Session state:
   - Si se guarda metadata del turno, hacerlo pasando por lib/conversation/session-state.ts.
   - Agregar provider metadata de forma compatible:

     stt: {
       provider: "deepgram_flux",
       model: "flux-general-en",
       transcriptChars,
       audioMs,
       endOfTurnConfidence
     }

   - Si esto implica migración grande, dejarlo para Prompt 5 y solo enviar el texto ahora.

Tests:
1. Usuario free → usa browser provider.
2. Usuario premium + flag browser → usa browser provider.
3. Usuario premium + flag deepgram_flux → intenta Deepgram.
4. Token 403 → fallback browser.
5. EndOfTurn → envía un solo turno.
6. Update → no envía turno.
7. End conversation manual sigue usando goodbye fijo y análisis.
8. Último turno real sigue siendo el único donde Alex se despide.

Comandos:
- npx tsc --noEmit
- npm test o npm run test
- npm run build

STOP & TEST:
Antes de avanzar, probar manualmente:
1. Free user en Chrome: comportamiento idéntico al actual.
2. Premium user con flag browser: comportamiento idéntico al actual.
3. Premium user con flag deepgram_flux: Deepgram transcribe y el texto llega al turno.
4. Premium con Deepgram API key inválida: fallback browser.
5. Premium con mic denegado: error recuperable.
6. End conversation manual: va al análisis.
```

---

# PROMPT 5 — Métricas, billing interno y observabilidad STT

Ejecutar después de que el flujo premium funcione manualmente.

```txt
Agregá métricas para evaluar Deepgram Flux en Fluent sin guardar audio crudo ni exponer datos sensibles.

Objetivo:
Medir calidad operativa, costo aproximado y UX del STT premium.

Primero auditá si ya existe infraestructura para eventos/métricas/billing. Si existe, reutilizala. Si no existe, proponé una tabla mínima con Drizzle y pedí confirmación antes de una migración grande.

Métricas por sesión/turno recomendadas:
- sessionId
- userId
- provider: browser_speech_recognition | deepgram_flux
- model: flux-general-en
- isPremium
- selectedByFlag: true/false
- fallbackUsed: true/false
- fallbackReason
- audioMsSent estimado
- transcriptChars
- endOfTurnConfidence
- tokenFetchMs
- wsOpenMs
- firstUpdateLatencyMs
- endOfTurnLatencyMs si se puede estimar
- deepgramTurnIndex
- mediaRecorderMimeType
- browser name/version si ya existe helper seguro
- errorCode normalizado
- createdAt

Privacidad:
- No guardar audio.
- No guardar accessToken.
- No guardar API key.
- No guardar transcript crudo salvo que el producto ya guarde conversaciones con consentimiento y esté alineado con la política existente.
- Si se necesita debug de transcript, usar solo en dev y nunca en producción por default.

Tareas:
1. Crear un modelo de evento STT o usar el logger existente.
2. Emitir eventos:
   - stt_provider_selected
   - deepgram_token_requested
   - deepgram_token_granted
   - deepgram_ws_open
   - deepgram_ws_close
   - deepgram_ws_error
   - deepgram_turn_start
   - deepgram_turn_update_first
   - deepgram_end_of_turn
   - stt_fallback_to_browser
3. Si hay DB billing/usage:
   - sumar audioMs por sesión premium
   - permitir ver costo aproximado por sesión luego
4. Agregar tests del logger/métricas:
   - no incluye token
   - no incluye audio
   - no incluye API key
   - normaliza errores
5. Agregar una pequeña utilidad para calcular duración estimada de audio enviado si no existe.

NO bloquear la conversación si falla el logging.

Comandos:
- npx tsc --noEmit
- npm test o npm run test
- npm run build

STOP & TEST:
Probar una sesión premium y verificar:
- aparecen eventos STT
- no hay tokens ni audio en logs
- audioMs/transcriptChars se registran
- fallback reason aparece si se fuerza error
```

---

# PROMPT 6 — Seguridad y límites de abuso

Ejecutar después de métricas básicas.

```txt
Hacé un hardening de seguridad para Deepgram Flux premium input.

Objetivo:
Reducir riesgo de abuso, filtración de secretos y consumo inesperado.

Tareas:
1. Revisar /api/stt/deepgram-token:
   - POST only
   - Supabase Auth requerido
   - premium gating requerido
   - Cache-Control no-store
   - no DEEPGRAM_API_KEY en response
   - no tokens en logs
   - errores genéricos hacia cliente

2. Rate limiting / cuotas:
   - Si ya existe rate limit o usage quota, reutilizarlo.
   - Limitar grants por usuario/sesión en ventana corta.
   - Limitar duración máxima de una práctica con Deepgram.
   - Limitar reconexiones automáticas.
   - Evitar loops de reconnect infinitos.
   - Si no hay infraestructura sólida, implementar solo guardas cliente + logging y dejar TODO explícito para rate limit server con DB/Redis.
   - No usar in-memory rate limit como seguridad real en Vercel.

3. Cliente:
   - cerrar mic tracks siempre en stop/cancel/unmount
   - cerrar WebSocket siempre en stop/cancel/unmount
   - cortar MediaRecorder si cambia de página
   - no reconectar más de N veces por turno
   - no pedir tokens en loop
   - no enviar audio si WS no está OPEN
   - no poner accessToken en URL

4. Origin/CSRF:
   - Revisar si el proyecto usa cookies Supabase y si conviene validar Origin/Host para POST del token endpoint.
   - Implementar validación si el patrón ya existe en otros endpoints.

5. Producción:
   - Asegurar que DEEPGRAM_API_KEY esté solo en Vercel env server-side.
   - Asegurar que NEXT_PUBLIC_PREMIUM_STT_PROVIDER pueda apagarse rápido.
   - Documentar rollback: poner NEXT_PUBLIC_PREMIUM_STT_PROVIDER=browser.

Tests:
- no loop de reconexión
- cancel/unmount libera recursos
- token endpoint no acepta GET
- token endpoint no filtra detalles sensibles
- usuario no premium no puede conseguir token

Comandos:
- npx tsc --noEmit
- npm test o npm run test
- npm run build

STOP & TEST:
Probar manualmente:
1. Usuario premium deja mic abierto: se corta por límite razonable.
2. Red cae durante WS: fallback o error recuperable.
3. Navegar fuera de la página: mic se apaga.
4. Usuario free intenta pegarle al token endpoint: 403.
5. Flag off: vuelve 100% al browser STT.
```

---

# PROMPT 7 — QA final, tuning y rollout gradual

Ejecutar después del hardening.

```txt
Prepará QA final y tuning para rollout gradual de Deepgram Flux.

Objetivo:
Dejar el feature listo para probar con usuarios premium reales de forma controlada.

Tareas:
1. Crear o actualizar documentación interna, por ejemplo docs/deepgram-flux-stt.md, con:
   - arquitectura
   - env vars
   - feature flags
   - fallback
   - métricas
   - troubleshooting
   - rollback

2. Agregar checklist de QA manual:
   - Chrome desktop premium
   - Safari desktop premium
   - Chrome Android si aplica
   - Safari iOS si aplica
   - free user
   - premium flag browser
   - premium flag deepgram_flux
   - Deepgram API key ausente
   - Deepgram API key inválida
   - mic denied
   - ruido de fondo
   - usuario con pausas largas
   - usuario con acento fuerte
   - End conversation manual
   - último turno real con despedida de Alex
   - análisis final

3. Tuning inicial recomendado:
   - model=flux-general-en
   - eot_threshold=0.8
   - eot_timeout_ms=7000
   - no eager_eot_threshold en MVP
   - si corta muy temprano, subir eot_timeout_ms o eot_threshold
   - si tarda mucho en cerrar turno, bajar eot_threshold o eot_timeout_ms

4. Definir métricas de aceptación:
   - Free no cambia.
   - Premium con flag Deepgram logra transcribir y enviar turnos.
   - Fallback rate menor a X% después de pruebas internas.
   - No hay duplicación de turnos.
   - No hay tokens ni audio en logs.
   - No hay API key en bundle cliente.
   - tsc/build/tests pasan.

5. Rollout:
   - Local dev
   - Beta interna con 1-2 cuentas premium
   - 10% premium si existe mecanismo de gradual rollout
   - 100% premium solo si métricas son buenas

6. Mejoras futuras, NO implementar ahora:
   - Flux multilingual: flux-general-multi con language_hint=en&language_hint=es
   - EagerEndOfTurn para reducir latencia
   - AudioWorklet + Linear16 16k mono si MediaRecorder/WebM falla en Safari/iOS
   - keyterm prompting por topic
   - UI para editar transcript antes de enviar
   - pronunciation scoring separado si el producto lo necesita

Comandos finales:
- npx tsc --noEmit
- npm test o npm run test
- npm run build

STOP & TEST:
Devolvé reporte final con:
- estado del feature
- flags/env necesarios
- pasos para probar local
- pasos para rollback
- riesgos pendientes
```

---

## Prompt opcional futuro — AudioWorklet Linear16 si MediaRecorder falla mucho

Usar solo si las pruebas muestran mala compatibilidad con MediaRecorder/WebM, especialmente en Safari/iOS.

```txt
Implementá una alternativa de captura de audio con AudioWorklet que convierta el micrófono a mono Linear16 16kHz y envíe chunks de ~80ms a Deepgram Flux.

Contexto:
El MVP usa MediaRecorder con WebM/Ogg Opus containerizado. Si eso falla en Safari/iOS o genera latencia/chunks irregulares, necesitamos una ruta más controlada.

Tareas:
1. Crear AudioWorkletProcessor para capturar Float32 PCM.
2. Resamplear a 16kHz mono.
3. Convertir Float32 [-1, 1] a Int16 little-endian.
4. Bufferizar chunks de ~80ms.
5. Enviar ArrayBuffer al WebSocket.
6. Cambiar websocketUrl para incluir:
   - encoding=linear16
   - sample_rate=16000
7. Mantener fallback MediaRecorder/browser.
8. Agregar tests unitarios para conversión Float32 → Int16 y resampling si es viable.
9. Medir latencia y CPU.

No implementar si MediaRecorder funciona aceptablemente.

STOP & TEST.
```

---

## Checklist mínimo antes de mergear

- [x] Free voice input sigue usando browser SpeechRecognition.
- [x] Premium puede usar Deepgram Flux con flag.
- [x] Token endpoint requiere Supabase Auth.
- [x] Token endpoint requiere premium.
- [x] `DEEPGRAM_API_KEY` nunca llega al cliente.
- [x] Browser usa token temporal.
- [x] No hay WebSocket server en Vercel.
- [x] No se loguea audio crudo.
- [x] No se loguea token temporal.
- [x] `Update` no dispara Claude.
- [x] `EndOfTurn` dispara un solo turno.
- [x] Fallback browser funciona.
- [x] End conversation manual sigue llevando al análisis.
- [x] Último turno real sigue siendo el único con despedida de Alex.
- [x] `npx tsc --noEmit` pasa.
- [x] `npm run build` pasa.
- [x] Tests pasan.

---

## Notas para producto

Deepgram Flux no debe comunicarse como “pronunciation correction”. Para Fluent, el mensaje correcto es:

```txt
Premium voice input uses a more reliable streaming speech-to-text engine for conversation practice.
```

Evitar claims como:

```txt
Perfect pronunciation detection
Accent-proof transcription
Always transcribes exactly what you said
```

Claims más seguros:

```txt
More consistent voice recognition
Streaming transcription
Better handling for conversational turn-taking
Fallback to browser voice input if premium STT is unavailable
```

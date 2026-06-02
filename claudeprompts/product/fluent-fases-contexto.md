# Fluent — Contexto del Proyecto y Plan de Fases (para Codex)

Leé esto antes de empezar cualquier fase. Define la visión, la arquitectura y cómo trabajamos.

---

## Qué es Fluent

Fluent ayuda a hispanohablantes a practicar inglés conversacional hablando por voz con
una AI llamada "Alex". El loop completo del producto es:

1. **Setup** — el usuario define su nivel de inglés (A1–C2), intereses y elige tema + duración.
2. **Conversación** — habla por voz con Alex. Alex responde adaptándose al nivel del usuario.
3. **Análisis** — al terminar, otra llamada a Claude analiza el transcript: fortalezas,
   debilidades y 3 puntos a mejorar. El usuario elige uno.
4. **Ejercicios** — Claude genera ejercicios personalizados sobre el punto elegido, temáticos
   según los intereses del usuario.
5. **Loop** — el usuario vuelve a conversar aplicando lo practicado.

Stack: Next.js 16 + Supabase (Auth + Postgres) + Drizzle ORM + Upstash Redis + Inngest +
Stripe + Resend. Inteligencia: Claude (Anthropic) para conversación, análisis y ejercicios.
Voz: Web Speech API (navegador) en free, ElevenLabs streaming en premium.

---

## La estrategia de dos fases

### Fase A — MVP Free (sale pronto)
Streaming de texto desde Claude + voz del navegador hablando ese texto.
Rápido de construir, valida producto, empieza a tener usuarios. Es gratis de operar
(la voz del navegador no cuesta API).

Archivo de prompts: `claudeprompts/fluent-fase-a-prompts.md`

### Fase B — Premium (el producto definitivo)
El chain de streaming coordinado: Claude → ElevenLabs (WebSocket) → cliente, con audio
de voz natural y texto sincronizado tipo karaoke aproximado. Una sola voz, sin saltos
de tono. Se siente como hablar con una persona real. Esto NO es un MVP — es el producto
que justifica el pago.

Archivo de prompts: `claudeprompts/fluent-fase-b-prompts.md`

### La clave que une las dos fases
El streaming de texto de Claude es IDÉNTICO en ambas fases. Lo único que cambia es a dónde
va el stream: en free va solo al frontend (voz del navegador); en premium va al frontend Y
a ElevenLabs en paralelo. Por eso la Fase A se construye "premium-ready": el endpoint de
streaming, el manejo de turnos y el estado del frontend son reutilizables. Pasar a Fase B
es agregar una rama, no reescribir.

---

## Cómo trabajamos

- **Un prompt a la vez.** Te paso los prompts del checklist de a uno, en orden.
- Completás el paso, mostrás el resultado (archivo o salida de terminal), espero a confirmar.
- Si algo falla, te paso el error exacto y lo arreglamos antes de avanzar.
- **Nunca saltes pasos** ni combines dos en uno salvo que lo pida explícitamente.
- Antes de cada fase, te paso primero su archivo de prompts para que leas el checklist completo.

---

## Estándares de código (aplican siempre)

**Seguridad:**
- API keys y secrets SOLO en el servidor. Nada de Anthropic/ElevenLabs/Stripe del lado cliente.
- Validar todo input de usuario con Zod antes de usarlo en queries o llamadas a APIs.
- Verificar autenticación antes de cualquier lectura/escritura a la DB.
- Nunca confiar en el userId del body — derivarlo siempre de la sesión autenticada.

**Eficiencia:**
- Lógica de negocio en lib/, no en los route handlers.
- Limitar el contexto de Claude a los últimos 20 turnos.
- try/catch en toda llamada externa (Anthropic, ElevenLabs, Supabase). Fallar con gracia,
  nunca romper la sesión del usuario.
- Las escrituras a la DB de turnos van async, fuera del camino crítico de la respuesta.
- Nunca guardar audioBase64 en la DB. Solo transcript estructurado { role, content, timestamp }.

**TypeScript:**
- Tipos estrictos. Nada de `any` salvo que sea inevitable (y comentado).
- Exportar tipos compartidos entre archivos.

**Testing:**
- Después de cada paso, correr `npx tsc --noEmit`.
- Para piezas delicadas (ElevenLabs streaming, audio chunked), testear aisladas antes de
  encadenarlas.

**Documentación:**
- Comentario de una línea arriba de cada archivo nuevo explicando qué hace.
- Comentar lógica no obvia (por qué bufferear tokens, por qué guardar async, etc.).
- Comentarios cortos y factuales.

---

## Estado actual

La Etapa 1 base (setup + conversación request/response) ya está construida y corriendo:
perfil de idioma, sesiones, el prompt de Alex, los componentes de setup y conversación.

Vamos a EVOLUCIONAR ese flujo a streaming. Empezamos por la **Fase A**.

---

## Ahora

Confirmá que leíste y entendiste esto. Después te paso el archivo de prompts de la Fase A
(`fluent-fase-a-prompts.md`) para que leas su checklist completo antes de arrancar con el
primer prompt (A1.1).
```


# Fluent — Capítulo de Monetización: Stripe + Sistema de Créditos

Conectar Stripe (ya parcialmente armado en el template) con el sistema de créditos, de forma
que sea imposible perder plata o que un usuario gaste más créditos de los que tiene.

## MODELO (definido)

- **Siempre premium**: todos los usuarios tienen acceso al servicio completo (voz ElevenLabs,
  análisis, ejercicios). La diferencia es cuántos créditos tenés, no qué features.
- **1 crédito = 1 conversación completa**: incluye la conversación (hasta 8 turnos), su
  análisis, y la práctica de las mejoras (teoría + ejercicios + ejercicio hablado). Todo eso
  es parte del crédito ya gastado.
- **El crédito se descuenta AL INICIAR la conversación**. Esto es lo que hace imposible
  gastar más que tus créditos. Sin crédito, no se puede iniciar una conversación nueva.
- **Free**: 5 créditos al registrarse, una sola vez.

## PRODUCTOS A CREAR EN STRIPE

### Suscripciones (recurring, mensual). Créditos que se RESETEAN cada mes (no se acumulan).
| Producto | Créditos/mes | Precio |
|----------|--------------|--------|
| Fluent Starter | 15 | $8.90/mes |
| Fluent Plus | 25 | $14.90/mes |
| Fluent Pro | 40 | $24.90/mes |

### Packs (one-time payment). Créditos que NO vencen (se acumulan al saldo).
| Producto | Créditos | Precio |
|----------|----------|--------|
| Pack Mini | 5 | $4.90 |
| Pack Medio | 10 | $8.90 |
| Pack Grande | 20 | $16.90 |

Nota: los precios y cantidades se pueden ajustar luego en el dashboard de Stripe sin tocar
código, siempre que el código lea la cantidad de créditos desde la metadata del producto/price
(ver más abajo).

## PRINCIPIO TÉCNICO CLAVE: "a prueba de trampas"

El descuento de crédito tiene que ser ATÓMICO y seguro. Tres ataques a prevenir:
1. **Doble gasto / carrera**: que un usuario abra 2 conversaciones simultáneas y gaste 1 solo
   crédito. Solución: descuento atómico en DB (transacción + check de saldo en la misma
   operación, o decremento condicional "UPDATE ... WHERE credits > 0 RETURNING").
2. **Crédito perdido por error**: que se descuente el crédito pero la conversación falle a
   crearse, dejando al usuario sin crédito y sin conversación. Solución: descontar y crear la
   sesión en la misma transacción; si algo falla, rollback (no se descuenta).
3. **Manipulación del saldo desde el cliente**: el saldo vive solo en el server, nunca se
   confía en un número que mande el cliente.

## CHECKLIST

### Bloque S0 — Estado actual y conexión
- [ ] S0.1 Inventario de qué hay ya armado de Stripe en el template
- [ ] S0.2 Conectar keys reales (test mode primero) + verificar webhook

### Bloque S1 — Productos y saldo de créditos
- [ ] S1.1 Crear los productos en Stripe con metadata de créditos
- [ ] S1.2 Schema/lógica del saldo de créditos del usuario
- [ ] S1.3 Otorgar 5 créditos free al registrarse

### Bloque S2 — Descuento atómico (a prueba de trampas)
- [ ] S2.1 Descuento atómico de crédito al iniciar conversación
- [ ] S2.2 Gating: sin crédito no se inicia, se ofrece comprar

### Bloque S3 — Pagos
- [ ] S3.1 Checkout de suscripción
- [ ] S3.2 Checkout de packs (one-time)
- [ ] S3.3 Webhook: otorgar créditos al pagar, resetear al renovar suscripción

### Bloque S4 — UI
- [ ] S4.1 Pantalla de planes/precios
- [ ] S4.2 Mostrar saldo de créditos + pantalla "comprar más" cuando se acaban

### Bloque S5 — Verificación
- [ ] S5.1 tsc + build + tests
- [ ] S5.2 Test end-to-end con Stripe test mode

---

## PROMPTS

---

### S0.1 — Inventario de Stripe existente

```
Vamos a armar el capítulo de monetización: Stripe + sistema de créditos. Antes de tocar nada,
inventario de lo que YA existe en el template. No cambies código, solo reportá:

1. ¿Qué archivos de Stripe existen? (client, checkout, webhook, portal). Listalos.
2. ¿Qué tablas relacionadas a pagos/créditos existen? Vi antes credits y transactions, 
   confirmá su estructura actual (columnas).
3. ¿El webhook de Stripe está implementado? ¿Qué eventos maneja hoy?
4. ¿Hay algún flujo de checkout o suscripción ya funcionando, aunque sea parcial?
5. ¿Hay lógica de "créditos" ya implementada en algún lado, o solo las tablas vacías?

Con eso sé desde dónde parto. Reportá ordenado.
```

---

### S0.2 — Conectar keys y verificar webhook

```
Conectemos Stripe en TEST MODE primero (nunca arrancamos con keys de producción).

1. Decime exactamente qué variables de entorno necesito setear (STRIPE_SECRET_KEY,
   STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY o como se llamen en el template) y dónde
   (.env.local para dev, Vercel para prod).
2. Explicame cómo configurar el webhook de Stripe apuntando a mi endpoint /api/stripe/webhook
   (en local con Stripe CLI, en prod con la URL de Vercel).
3. Confirmá que el endpoint del webhook valida la firma de Stripe (esto ya estaba OK en la
   auditoría de seguridad, solo reconfirmá).

No crees productos todavía. Solo dejame la conexión lista y dame los pasos manuales que tengo
que hacer yo en el dashboard de Stripe y en la CLI.
```

---

### S1.1 — Productos en Stripe con metadata

```
Creá la definición de los productos. CLAVE: la cantidad de créditos de cada producto tiene que
venir de la METADATA del price en Stripe, no hardcodeada en el código. Así puedo cambiar
cantidades y precios en el dashboard sin tocar código.

Productos a crear (te los doy, vos me decís cómo crearlos en el dashboard de Stripe y cómo los
referencia el código):

SUSCRIPCIONES (recurring mensual):
- Fluent Starter: 15 créditos/mes, $8.90/mes
- Fluent Plus: 25 créditos/mes, $14.90/mes
- Fluent Pro: 40 créditos/mes, $24.90/mes

PACKS (one-time):
- Pack Mini: 5 créditos, $4.90
- Pack Medio: 10 créditos, $8.90
- Pack Grande: 20 créditos, $16.90

Cada price en Stripe debe tener metadata: { credits: N, type: "subscription"|"pack" }.

1. Dame los pasos para crear estos productos+prices en el dashboard de Stripe con su metadata.
2. Creá en el código una forma de leer esa metadata (un helper que dado un priceId devuelva
   cuántos créditos otorga y si es suscripción o pack).
3. NO hardcodees cantidades ni precios en el código; todo desde la metadata.
Mostrame el helper.
```

---

### S1.2 — Saldo de créditos

```
Implementá el saldo de créditos del usuario. Reusá la tabla credits del template si sirve,
o ajustala.

El usuario tiene que tener:
- credits_subscription: créditos de su suscripción del mes actual (se RESETEAN al renovar).
- credits_pack: créditos comprados en packs (NO vencen, se acumulan).
- Saldo total disponible = credits_subscription + credits_pack.

Al consumir un crédito, descontar PRIMERO de credits_subscription (los que vencen) y después
de credits_pack (los que no vencen), para que el usuario aproveche primero lo que va a perder.

Creá:
- Las columnas/estructura necesarias (migración Drizzle).
- getUserCreditBalance(userId): devuelve subscription, pack, y total.
- Una función para consumir 1 crédito (la lógica atómica la detallamos en S2.1).
- RLS: el usuario solo lee su propio saldo. Nunca se escribe el saldo desde el cliente.

Mostrame el schema y las funciones de lectura. Recordame db:migrate.
```

---

### S1.3 — Créditos free al registrarse

```
Cuando un usuario nuevo se registra, otorgale 5 créditos free (una sola vez).

- Estos 5 créditos van a credits_pack (no vencen) o a un campo credits_free, lo que sea más
  limpio. Que NO se reseteen.
- IMPORTANTE anti-abuso: que sea imposible obtener los 5 créditos más de una vez por cuenta.
  Atalo al alta del usuario (un flag "free_credits_granted" o que se otorguen en la creación
  del perfil, de forma idempotente).
- Esto NO previene que alguien cree múltiples cuentas con distintos emails; eso es un problema
  aparte que vigilaremos después. Acá solo aseguramos que UNA cuenta no pueda reclamar los 5
  créditos dos veces.

Mostrame cómo y dónde se otorgan.
```

---

### S2.1 — Descuento atómico (lo más importante)

```
Este es el corazón del sistema y tiene que ser A PRUEBA DE TRAMPAS. Implementá el descuento
atómico de 1 crédito al iniciar una conversación.

REQUISITOS DE SEGURIDAD:
1. ATÓMICO: el check de saldo y el descuento ocurren en UNA sola operación de DB que no se
   pueda interrumpir. Usá un decremento condicional tipo:
   UPDATE ... SET credits = credits - 1 WHERE userId = ? AND (saldo total) >= 1 RETURNING ...
   Si no devuelve fila, no había crédito → no se inició nada. Esto previene el doble gasto por
   conversaciones simultáneas (condición de carrera).
2. TRANSACCIONAL con la creación de la sesión: descontar el crédito Y crear la conversation
   session en la MISMA transacción. Si la creación de la sesión falla, rollback del descuento.
   El usuario nunca pierde un crédito sin recibir su conversación.
3. ORDEN de descuento: primero credits_subscription, después credits_pack.
4. Registrar la transacción en la tabla transactions (auditoría: qué se descontó, cuándo,
   por qué sesión).
5. El saldo vive solo en el server. Nunca se confía en un número del cliente.

Integralo en /api/conversation/start: antes de crear la sesión, intentar descontar 1 crédito
atómicamente. Si no hay crédito, devolver un error claro (402 Payment Required o similar) que
el front use para mostrar "comprá más créditos". Si hay crédito, descontar + crear sesión en
la transacción.

Mostrame la implementación del descuento atómico y cómo se integra en start. Escribí un test
que simule dos requests concurrentes y confirme que solo se descuenta 1 crédito.
```

---

### S2.2 — Gating sin crédito

```
Asegurá que sin crédito no se pueda iniciar ninguna conversación, en TODOS los caminos.

- /api/conversation/start ya descuenta atómico (S2.1). Confirmá que si el descuento falla por
  falta de crédito, no se crea sesión y se devuelve el error de "sin créditos".
- El análisis y los ejercicios de una sesión YA pagada (con su crédito ya descontado) NO
  descuentan crédito extra — son parte del crédito de esa conversación. Confirmá que analyze
  y generate verifican que la sesión pertenezca a un crédito ya gastado, pero no descuentan de
  nuevo.
- Verificá que no haya forma de iniciar una conversación saltándose el descuento (ej: llamar
  directo a stream sin pasar por start).

Mostrame los chequeos.
```

---

### S3.1 — Checkout suscripción

```
Implementá el checkout de suscripción con Stripe Checkout.
- Endpoint que crea una Checkout Session para el priceId de la suscripción elegida.
- userId del usuario autenticado (nunca del cliente), asociado a la sesión de Stripe
  (client_reference_id o customer).
- Success y cancel URLs apropiadas.
- Modo subscription.
Reusá lo que el template ya tenga de checkout. Mostrame el endpoint.
```

---

### S3.2 — Checkout packs

```
Implementá el checkout de packs (pago único).
- Igual que S3.1 pero modo payment (one-time), para los priceId de packs.
- userId autenticado asociado.
Mostrame el endpoint o cómo se reusa el de suscripción con modo distinto.
```

---

### S3.3 — Webhook: otorgar créditos

```
Implementá el manejo de eventos del webhook de Stripe para otorgar créditos. CLAVE: los
créditos se otorgan SOLO desde el webhook (server-to-server verificado por firma), nunca
desde el success URL del cliente (que se puede falsificar).

Eventos a manejar:
1. checkout.session.completed (pack one-time): leer credits de la metadata del price, sumarlos
   a credits_pack del usuario. Registrar en transactions.
2. invoice.paid o customer.subscription.created/updated (suscripción): setear
   credits_subscription al valor del plan (RESET, no suma — los del mes anterior se pierden).
   Registrar en transactions.
3. customer.subscription.deleted (cancelación): marcar la suscripción como inactiva. Los
   credits_pack que tenga NO se tocan (no vencen).

IDEMPOTENCIA: el webhook puede recibir el mismo evento más de una vez. Usá el event.id de
Stripe para no otorgar créditos dos veces por el mismo evento (guardá los event.id procesados
o usá un check de idempotencia).

Mostrame el manejo de cada evento y la lógica de idempotencia.
```

---

### S4.1 — Pantalla de planes

```
Creá la pantalla de planes/precios. Muestra las 3 suscripciones (Starter/Plus/Pro) y los 3
packs (Mini/Medio/Grande), con sus créditos y precios. Botón de cada uno que dispara el
checkout correspondiente (S3.1/S3.2).

Las cantidades y precios deberían venir de los productos de Stripe (o de una config que
espeje la metadata), no hardcodeados en el JSX, para que cambiar precios en Stripe se refleje.
Diseño claro, destacá la suscripción como la opción recomendada (mejor precio por crédito).
Tailwind. Mostrame.
```

---

### S4.2 — Saldo y "comprar más"

```
1. Mostrá el saldo de créditos del usuario en un lugar visible (header del dashboard o de la
   pantalla de práctica): "X créditos".
2. Cuando el usuario intenta iniciar una conversación sin créditos (el error de S2.1), mostrá
   una pantalla/modal que explique que se quedó sin créditos y lo lleve a la pantalla de planes
   (S4.1) a comprar suscripción o pack.
3. El saldo se lee del server (getUserCreditBalance), nunca se calcula en el cliente.
Mostrame los componentes.
```

---

### S5.1 / S5.2 — Verificación

```
S5.1: tsc --noEmit, build, tests.

S5.2: Test end-to-end con Stripe TEST MODE:
1. Usuario nuevo → confirmá que recibe 5 créditos free (y que no puede reclamarlos dos veces).
2. Iniciar conversaciones hasta agotar los créditos → confirmá que descuenta 1 por conversación
   y que el análisis/ejercicios de esas conversaciones NO descuentan extra.
3. Sin créditos → confirmá que no puede iniciar y que se ofrece comprar.
4. Comprar un pack con tarjeta de test → confirmá que el webhook otorga los créditos.
5. Suscribirse con tarjeta de test → confirmá que otorga los créditos del plan.
6. Simular renovación → confirmá que los créditos de suscripción se RESETEAN (no se acumulan)
   y que los de pack se mantienen.
7. Probar el doble gasto: dos requests concurrentes de start con 1 solo crédito → confirmá que
   solo se descuenta 1 y solo se crea 1 sesión.
Reportá cada punto.
```

---

## PASOS MANUALES TUYOS (no de Codex)
- Crear cuenta/proyecto en Stripe si no está.
- Crear los 6 productos con su metadata de créditos en el dashboard (Codex te da los pasos).
- Setear las keys en .env.local (test) y luego en Vercel (prod).
- Configurar el webhook (Stripe CLI en local, URL de Vercel en prod).
- Usar tarjetas de test de Stripe (4242 4242 4242 4242) para las pruebas.
- Pasar a keys de producción solo después de que todo el flujo funcione en test mode.

## ORDEN
S0 (inventario + conexión) → S1 (productos + saldo + free) → S2 (descuento atómico, lo más
crítico) → S3 (pagos + webhook) → S4 (UI) → S5 (verificación). Un prompt por vez, testeo entre
cada uno, documentar en FASE-STRIPE-PROGRESO.md.

# Fluent — Tabla Maestra de Costos y Modelo de Negocio

## PRECIOS UNITARIOS OFICIALES (su unidad de medida)

| Servicio | Precio | Por unidad |
|----------|--------|-----------|
| Claude entrada | $3.00 / millón tokens | $0.000003 / token |
| Claude salida | $15.00 / millón tokens | $0.000015 / token |
| ElevenLabs | $0.05 / 1.000 chars | $0.00005 / char |
| Deepgram Flux | $0.0065 / minuto | $0.0001083 / segundo |

---

## TABLA MAESTRA: límite por etapa × precio = costo máximo

| Etapa | Servicio | Límite puesto | Costo máx |
|-------|----------|---------------|-----------|
| 1 · Usuario habla | Deepgram | 240s (30s × 8 turnos) | $0.026 |
| 2 · Claude responde | Claude | 1.200 tok out / ~24.8K tok in | $0.092 |
| 3 · Voz de Alex | ElevenLabs | ~4.800 chars | $0.240 |
| 4 · Análisis | Claude | 6K in / 1.2K out | $0.036 |
| 5 · Práctica 3 tópicos | Claude+11L+DG | 3 × (teoría + 7 ejerc + voz) | $0.364 |
| **TOTAL = 1 crédito (peor caso)** | | | **$0.759** |
| Costo REAL medido (capturas) | | | **~$0.06** |

Ratio peor caso / real: ~13×

### Detalle Etapa 5 (por tópico, × 3)
- Claude (teoría + 7 ejercicios + check voz + traducción): $0.082
- ElevenLabs (audio de 3 ejemplos de teoría): $0.036
- Deepgram (ejercicio hablado ~30s): $0.003
- Subtotal por tópico: $0.121 → × 3 = $0.364

---

## LÍMITES MENSUALES CONFIGURADOS (anti-abuso)

| Recurso | Límite por minuto | Límite mensual |
|---------|-------------------|----------------|
| Conversación Claude | 5/min/user | 600 turnos/mes |
| Análisis Claude | 4/min/user | 60/mes |
| Generación ejercicios | 4/min/user | 120 sets/mes |
| Check-speech Claude | 20/min/user | 300/mes |
| Traducciones Claude | 10/min/user | 300/mes |
| Exercise TTS ElevenLabs | 10/min/user | 250 req/mes (max 400 chars c/u) |
| Conversation TTS ElevenLabs | — | 100.000 chars/mes |
| Deepgram token grants | 12/min/user, 8/min/session | 300 min/mes |

Nota: el targetTurns está topado a 8 en el backend (no solo UI). El crédito se descuenta
al INICIAR la conversación, así que el techo real lo da la cantidad de créditos, no estos
límites (que son red de seguridad adicional).

---

## COSTOS FIJOS vs VARIABLES

### Fijos (no dependen de usuarios) — ~$55/mes
- Supabase Pro: ~$25
- Vercel Pro: ~$20
- Upstash Redis: ~$10
Se cubren con los primeros 3-4 usuarios premium.

### Variables (escalan con uso)
- APIs de AI: ~$0.06/crédito real, $0.76/crédito peor caso
- Stripe: ~2.9% + $0.30 por transacción

---

## SIMULACIÓN DE ESCALA (plan $19/mes, uso promedio 15 créditos)

| Usuarios | Ingresos | Margen real ($0.06/cr) | Margen medio ($0.30/cr) | Margen peor ($0.80/cr) |
|----------|----------|------------------------|--------------------------|-------------------------|
| 10 | $190 | 62% | 43% | 3% |
| 50 | $950 | 85% | 66% | 27% |
| 100 | $1.900 | 88% | 69% | 29% |
| 1000 | $19.000 | 90% | 72% | 32% |

Conclusión: rentable en prácticamente cualquier escenario realista. El peor caso con muy
pocos usuarios es el único punto ajustado, pero es un escenario casi imposible.

---

## MODELO DE NEGOCIO DEFINIDO

- **Siempre premium** (todo el servicio, voz ElevenLabs incluida).
- **Free: 5 créditos al registrarse**, una vez. Luego invita a comprar.
- **Suscripción mensual** (posición 3-4 en escala flexible→conservador): créditos generosos,
  precio accesible. Los créditos mensuales NO se acumulan (se pierden al renovar).
- **Créditos sueltos / packs** (posición 5-6, un poco más conservador): para enganchar hacia
  la suscripción. Los packs comprados NO vencen.
- Planes por tamaño: 15 / 25 / 40 conversaciones (precios a definir según mercado).
- Sin créditos → no se puede iniciar conversación nueva → se ofrece comprar.

### Posición elegida en escala flexible (1) → conservador (10)
- Suscripción: 3-4 (flexible, créditos generosos para enganchar y retener)
- Créditos sueltos: 5-6 (un poco más conservador, para incentivar la suscripción)

---

## COSTO DE ADQUISICIÓN (free)
5 créditos gratis = ~$0.30 costo real (~$4 peor caso) por usuario registrado.
VIGILAR: abuso de cuentas free múltiples (único agujero real del modelo).

---

## PRECIOS FINALES DEFINIDOS

### Suscripciones (~$0.60/crédito, créditos mensuales que NO se acumulan)
| Plan | Créditos/mes | Precio | $/crédito efectivo |
|------|--------------|--------|--------------------|
| Starter | 15 conversaciones | $8.90/mes | $0.593 |
| Plus | 25 conversaciones | $14.90/mes | $0.596 |
| Pro | 40 conversaciones | $24.90/mes | $0.622 |

### Packs sueltos (~$0.80/crédito, NO vencen)
| Pack | Créditos | Precio | $/crédito efectivo |
|------|----------|--------|--------------------|
| Mini | 5 créditos | $4.90 | $0.980 |
| Medio | 10 créditos | $8.90 | $0.890 |
| Grande | 20 créditos | $16.90 | $0.845 |

### Free
- 5 créditos al registrarse, una sola vez.

### Lógica de precios
- Suscripción SIEMPRE más barata por crédito que los packs → incentiva suscribirse.
- Márgenes: suscripción ~90% (costo real) / break-even contra "casi exagerado" $0.60.
  Packs ~93% (costo real) / 29% (casi exagerado).
- Precios psicológicos terminados en .9.
- Ajustables en el dashboard de Stripe sin tocar código.

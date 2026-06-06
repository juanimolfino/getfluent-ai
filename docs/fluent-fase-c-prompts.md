# Fluent — Fase C: Producto Post-Conversación (Análisis + Teoría + Ejercicios)

El loop de aprendizaje que convierte Fluent en una herramienta educativa real:
conversación → análisis → teoría → ejercicios → volver a conversar.

## FILOSOFÍA DE DISEÑO (lo más importante de toda la fase)

El objetivo NO es solo que funcione hoy, sino que sea FÁCIL agregar nuevos tipos de
ejercicios y propuestas educativas en el futuro, estilo Duolingo. Para lograrlo:

**Separamos el CONTRATO del CONTENIDO.**
- El CONTRATO: la estructura de datos de cada tipo de ejercicio (campos fijos, type conocido).
  Lo definimos nosotros. No cambia.
- El CONTENIDO: lo que Claude genera para llenar ese contrato. Cambia cada vez.

**Claude NUNCA devuelve formato libre.** Claude llena una estructura JSON con forma conocida,
validada con Zod. El front tiene un componente por cada \`type\` de ejercicio, y un renderer
que mira el \`type\` y dibuja el componente correcto.

**Para agregar un ejercicio nuevo en el futuro:** se define un tipo nuevo + su componente +
se le enseña a Claude en el prompt. Nada de lo existente se rompe. Esto es extensibilidad.

## PRINCIPIOS PEDAGÓGICOS

- ESPECIFICIDAD: el análisis cita lo que el usuario REALMENTE dijo. Nunca genérico.
- BREVEDAD estilo Duolingo: teoría concisa, buena, con ejemplos. Ejercicios cortos.
- AUDIO: la teoría y los ejemplos tienen botón para escuchar la pronunciación (ElevenLabs).
- PROGRESIÓN: ejercicios de fácil a difícil (reconocer → completar → producir).
- PERSONALIZACIÓN: todo temático según los intereses del usuario.
- ALENTAR: tono de profesor que motiva, nunca que humilla.

## PRINCIPIOS TÉCNICOS

- Seguridad de siempre: auth antes de DB, Zod en inputs, userId de la sesión.
- Análisis y ejercicios: una llamada a Claude cada uno, con salida JSON validada.
- Cachear: no re-analizar ni re-generar lo ya hecho.
- Un prompt a la vez, testeo entre cada uno, documentar en FASE-C-PROGRESO.md.

---

## CHECKLIST — FASE C

### Bloque C0 — El sistema de tipos (la base extensible)
- [ ] C0.1 Definir el sistema de tipos de ejercicios (contrato + Zod + registry)

### Bloque C1 — Análisis
- [ ] C1.1 Schema de análisis y ejercicios
- [ ] C1.2 Prompt de análisis (Claude profesor)
- [ ] C1.3 Endpoint de análisis
- [ ] C1.4 Pantalla de análisis (puntos detectados + elegir)

### Bloque C2 — Teoría con audio
- [ ] C2.1 Prompt de teoría
- [ ] C2.2 Endpoint de generación (teoría)
- [ ] C2.3 Pantalla de teoría con botón de audio (ElevenLabs)

### Bloque C3 — Ejercicios
- [ ] C3.1 Prompt de generación de ejercicios (usando el sistema de tipos)
- [ ] C3.2 Completar endpoint de generación
- [ ] C3.3 El ExerciseRenderer + componentes por tipo
- [ ] C3.4 Ejercicio hablado (reusa motor de voz)

### Bloque C4 — Cierre del loop
- [ ] C4.1 Resumen + volver a conversar

### Bloque C5 — Verificación
- [ ] C5.1 tsc + build + tests
- [ ] C5.2 Test end-to-end del loop

---

## PROMPTS — FASE C

---

### PROMPT C0.1 — El sistema de tipos de ejercicios (LA BASE)

\`\`\`
Antes de cualquier otra cosa de la Fase C, construimos la base que hace que el sistema de 
ejercicios sea estandarizado y fácil de extender en el futuro (estilo Duolingo). Esto es 
puramente la definición de tipos, sin lógica todavía.

Creá lib/exercises/types.ts con:

1. Un union type ExerciseType con los tipos que soportamos hoy:
   type ExerciseType = "multiple_choice" | "fill_blank" | "speak"
   (diseñado para agregar más en el futuro sin romper nada)

2. Una interfaz base y una interfaz por tipo, todas con un campo "type" discriminador:

   interface BaseExercise {
     id: string;
     type: ExerciseType;
     instruction: string;        // consigna corta para el usuario
     explanation: string;        // por qué la respuesta correcta es correcta
   }

   interface MultipleChoiceExercise extends BaseExercise {
     type: "multiple_choice";
     question: string;
     options: string[];          // 3-4 opciones
     correctIndex: number;       // índice de la opción correcta
   }

   interface FillBlankExercise extends BaseExercise {
     type: "fill_blank";
     sentence: string;           // con un marcador ___ donde va el hueco
     correctAnswer: string;
     acceptableAnswers?: string[]; // variantes válidas (case/espacios)
   }

   interface SpeakExercise extends BaseExercise {
     type: "speak";
     promptText: string;         // qué tiene que decir/lograr el usuario
     exampleAnswer: string;      // una respuesta ejemplo válida
   }

   type Exercise = MultipleChoiceExercise | FillBlankExercise | SpeakExercise;

3. Un schema de Zod por cada tipo y un schema discriminado (z.discriminatedUnion sobre "type")
   que valide cualquier Exercise. Esto es lo que usaremos para validar lo que devuelve Claude.

4. Exportá también una descripción legible de cada tipo (un objeto EXERCISE_TYPE_SPECS) que
   describe en texto qué es cada tipo y qué campos lleva. Esto lo vamos a inyectar en el 
   prompt de Claude para que sepa exactamente qué generar. La idea: la "fuente de verdad" de 
   qué tipos existen vive acá, y tanto el front como el prompt de Claude la consumen.

Comentá arriba del archivo: "Sistema de tipos de ejercicios. Para agregar un tipo nuevo:
1) agregar a ExerciseType, 2) crear su interfaz + schema Zod, 3) agregarlo al discriminatedUnion
y a EXERCISE_TYPE_SPECS, 4) crear su componente en el ExerciseRenderer. Nada más se toca."

Mostrame el archivo completo. tsc --noEmit.
\`\`\`

---

### PROMPT C1.1 — Schema de DB

\`\`\`
Agregá al schema de Drizzle (solo append):

Tabla conversation_analyses:
- id uuid pk defaultRandom
- sessionId uuid notNull
- userId uuid notNull
- encouragement text notNull              // lo que hizo bien
- weakPoints jsonb tipo WeakPoint[] notNull
  WeakPoint = { id, title, category, explanation, userExample, betterVersion }
- createdAt timestamp notNull defaultNow

Tabla exercise_sets:
- id uuid pk defaultRandom
- analysisId uuid notNull
- userId uuid notNull
- weakPointId text notNull
- theory jsonb tipo Theory notNull
  Theory = { summary: string, examples: string[] }
- exercises jsonb tipo Exercise[] notNull   // usa el tipo Exercise de lib/exercises/types.ts
- score integer (nullable)                  // aciertos al completar
- completedAt timestamp (nullable)
- createdAt timestamp notNull defaultNow

Importá el tipo Exercise desde lib/exercises/types.ts para tipar la columna exercises.
Generá migración, recordame db:migrate, y creá fase-c-rls.sql con políticas RLS (mismo patrón:
usuario solo accede a lo suyo). Mostrame el schema.
\`\`\`

---

### PROMPT C1.2 — Prompt de análisis (Claude profesor)

\`\`\`
Creá lib/exercises/analysis-prompt.ts con buildAnalysisPrompt(config).
config: { transcript, englishLevel, topic, interests }

Claude actúa como profesor de inglés experto y empático. Instrucciones del prompt:
1. Lee el transcript completo.
2. Identifica 1-3 puntos débiles CONCRETOS (no genéricos), priorizando los más frecuentes o 
   los que más afectan la comunicación.
3. Por cada punto: title (corto), category (grammar|vocabulary|fluency|pronunciation),
   explanation (simple, alentador, adaptado al nivel {englishLevel}, sin jerga), userExample 
   (frase REAL citada del transcript donde se ve el error), betterVersion (cómo se diría bien).
4. Empieza reconociendo algo que el usuario hizo BIEN (campo encouragement).
5. Adaptá la exigencia al nivel. No marques sutilezas de C1 a un A1.
6. Si la conversación fue muy corta o sin errores claros, devolvé menos puntos (o 0) — no 
   inventes errores.

Salida JSON válido y NADA más (sin markdown):
{ "encouragement": "...", "weakPoints": [ { "id","title","category","explanation",
  "userExample","betterVersion" } ] }

Mostrame el prompt.
\`\`\`

---

### PROMPT C1.3 — Endpoint de análisis

\`\`\`
Creá app/api/conversation/analyze/route.ts (POST).
1. Auth + db user. Zod body { sessionId }.
2. Cargá sesión (session-state), validá ownership, debe estar completed/analyzed.
3. Si ya hay análisis para esa sesión, devolvelo (cachear, no re-analizar).
4. Cargá perfil (nivel, intereses). Construí prompt con el transcript.
5. Claude NO streaming, pedí JSON. Limpiá fences de markdown, parseá con try/catch, validá con 
   Zod antes de guardar.
6. Guardá en conversation_analyses, marcá sesión "analyzed", devolvé el análisis.
Manejá errores con gracia. Mostrame el endpoint.
\`\`\`

---

### PROMPT C1.4 — Pantalla de análisis

\`\`\`
Actualizá la pantalla de análisis para mostrar el análisis real (hoy es placeholder).
- Al cargar, si no hay análisis, llamá a /api/conversation/analyze. Loading: "Tu profesor 
  está revisando la conversación...".
- Mostrá: el encouragement arriba (cálido, destacado), y los 1-3 weakPoints como tarjetas.
- Cada tarjeta: title + ícono según category, explanation, "Vos dijiste:" userExample (rojo 
  suave) → "Mejor:" betterVersion (verde suave), y botón "Practicar esto".
- "Practicar esto" navega a la pantalla de teoría/ejercicios pasando analysisId + weakPointId.
- Diseño limpio y alentador, estilo Duolingo: breve, claro, visual. Tailwind. Mostrame.
\`\`\`

---

### PROMPT C2.1 — Prompt de teoría

\`\`\`
Creá lib/exercises/theory-prompt.ts con buildTheoryPrompt(config).
config: { weakPoint, englishLevel, interests }

Claude genera una mini-lección MUY breve estilo Duolingo:
- summary: 3-4 oraciones máximo, regla en lenguaje simple, adaptado al nivel.
- examples: 2-3 ejemplos claros, temáticos según intereses.
- Tono cálido, directo, sin jerga. Que se entienda en 30 segundos.

Salida JSON: { "summary": "...", "examples": ["...","...","..."] }
Mostrame el prompt.
\`\`\`

---

### PROMPT C2.2 — Endpoint de generación (teoría primero)

\`\`\`
Creá app/api/exercises/generate/route.ts (POST). Genera teoría + ejercicios en una sola 
llamada lógica, pero por ahora implementá solo teoría (ejercicios en C3.2).
1. Auth + Zod { analysisId, weakPointId }.
2. Cargá análisis, validá ownership, encontrá el weakPoint.
3. Si ya existe exercise_set para analysisId+weakPointId, devolvelo (cachear).
4. Cargá perfil. Generá teoría con buildTheoryPrompt + Claude (JSON, validado con Zod).
5. Guardá exercise_set con la teoría (exercises vacío por ahora). Devolvé la teoría.
Mostrame el endpoint.
\`\`\`

---

### PROMPT C2.3 — Pantalla de teoría con audio

\`\`\`
Creá la pantalla de teoría. Muestra summary y examples de forma clara y atractiva (estilo 
Duolingo: tarjeta limpia, espaciada, agradable).

AUDIO: cada ejemplo tiene un botón de "escuchar" (ícono de altavoz) que reproduce ese ejemplo 
con voz de ElevenLabs para que el usuario escuche la pronunciación nativa.
- Para premium: usá ElevenLabs (puede ser una llamada al TTS no-streaming, o reusá lo que 
  tengas; el texto es corto). Para free: usá la voz del navegador (speechSynthesis), igual 
  que en la conversación free.
- Reusá los helpers de voz existentes (browser-voice, etc), no dupliques.

Botón "Empezar ejercicios" al final que va a la pantalla de ejercicios. Tailwind. Mostrame.
\`\`\`

---

### PROMPT C3.1 — Prompt de generación de ejercicios (usa el sistema de tipos)

\`\`\`
Creá lib/exercises/exercise-prompt.ts con buildExercisesPrompt(config).
config: { weakPoint, theory, englishLevel, interests }

IMPORTANTE: el prompt debe inyectar las EXERCISE_TYPE_SPECS de lib/exercises/types.ts para 
que Claude sepa EXACTAMENTE qué estructura tiene cada tipo de ejercicio. Así, cuando agreguemos 
tipos nuevos en el futuro, solo actualizamos types.ts y el prompt se actualiza solo.

Claude genera una serie de 5-7 ejercicios sobre el weakPoint, con progresión:
- 2-3 "multiple_choice" (los más fáciles)
- 2-3 "fill_blank" (dificultad media)
- 1 "speak" al final (producción, el más difícil)
- Todos temáticos según intereses. Cada uno con su instruction y explanation.

CRÍTICO: la salida debe ser un array JSON de ejercicios que cumpla EXACTAMENTE el schema 
discriminado de Exercise (de types.ts). Cada ejercicio con su "type" y los campos que ese 
tipo requiere. Nada de formato libre. Mostrame el prompt.
\`\`\`

---

### PROMPT C3.2 — Completar endpoint de generación

\`\`\`
Completá /api/exercises/generate: después de la teoría, generá los ejercicios con 
buildExercisesPrompt + Claude. Validá el array con el discriminatedUnion de types.ts 
(esto garantiza que cada ejercicio tiene la forma correcta de su tipo). Guardá teoría + 
ejercicios en el exercise_set. Si el JSON de Claude no valida, logueá qué ejercicio falló y 
devolvé error claro. Mostrame el endpoint.
\`\`\`

---

### PROMPT C3.3 — ExerciseRenderer + componentes por tipo

\`\`\`
Acá está la clave de la extensibilidad. Creá:

1. components/exercises/ExerciseRenderer.tsx: recibe un Exercise, mira exercise.type, y 
   renderiza el componente correcto con un switch. Si llega un type desconocido (futuro), 
   muestra un fallback amable, no rompe.

2. Un componente por tipo, cada uno en components/exercises/:
   - MultipleChoiceExercise.tsx: muestra question + options como botones. Al elegir: marca 
     correcto (verde) / incorrecto (rojo), muestra explanation, botón "Siguiente".
   - FillBlankExercise.tsx: muestra sentence con el hueco + input. Al enviar: compara con 
     correctAnswer y acceptableAnswers (case-insensitive, trim). Feedback + explanation + 
     "Siguiente".
   - SpeakExercise.tsx: placeholder por ahora (lo completa C3.4).

3. Una pantalla contenedora que muestra los ejercicios de a uno, con progreso ("3 de 6"), 
   lleva el conteo de aciertos, y usa el ExerciseRenderer para cada uno.

Feedback alentador: si está mal, "¡Casi! Es X porque..." no un error seco.
Diseño estilo Duolingo: una cosa a la vez, grande, claro, con progreso visible. Tailwind.

El punto de todo esto: agregar un tipo nuevo de ejercicio en el futuro = crear un componente 
nuevo + un case en el switch del Renderer. Lo demás no se toca. Mostrame todo.
\`\`\`

---

### PROMPT C3.4 — Ejercicio hablado

\`\`\`
Completá SpeakExercise.tsx reusando el motor de voz existente (Deepgram premium / browser 
free, la misma lógica de la conversación).

Flujo:
1. Muestra promptText (qué tiene que decir).
2. El usuario toca un botón y habla. Se transcribe con el sistema existente (reusá los 
   hooks/componentes de la conversación, no dupliques).
3. Manda lo que dijo a /api/exercises/check-speech con { exerciseId, weakPointId, transcript, 
   instruction }.
4. Muestra el feedback de Claude.

Creá app/api/exercises/check-speech/route.ts:
- Auth + Zod. Prompt a Claude: "El usuario practica {weakPoint}. Consigna: {instruction}. 
  Dijo: {transcript}. ¿Aplicó bien el punto? Devolvé JSON { correct: bool, feedback: string 
  (alentador, específico), correctedVersion: string }". Validá con Zod. Devolvé el feedback.
Mostrame los cambios.
\`\`\`

---

### PROMPT C4.1 — Cierre del loop

\`\`\`
Al terminar la serie, pantalla de resumen:
- Aciertos / total. Guardá score y completedAt en el exercise_set.
- Mensaje alentador según el % (podés tener templates por rango de score).
- Botones: "Volver a conversar" (→ /practice nueva sesión) y "Ver análisis de nuevo".
Estilo Duolingo: celebratorio pero simple. Mostrame la pantalla.
\`\`\`

---

### PROMPT C5.1 / C5.2 — Verificación

\`\`\`
C5.1: tsc --noEmit, build, tests. Arreglá lo que falle.

C5.2: Test end-to-end:
1. Conversación premium → terminar → análisis (confirmá que cita lo que dijiste de verdad).
2. Elegir punto → teoría (breve, temática, con audio funcionando).
3. Ejercicios: multiple_choice, fill_blank, y el speak hablado (confirmá que reusa el motor 
   de voz y que Claude corrige).
4. Resumen → volver a conversar.
Pasame el flujo completo para revisar calidad pedagógica.
\`\`\`

---

## NOTA SOBRE EXTENSIBILIDAD FUTURA

Gracias al C0.1 (sistema de tipos), agregar nuevos ejercicios después es directo. Ejemplos 
de tipos que podrías sumar sin reescribir nada:
- "reorder": ordenar palabras para formar una oración correcta
- "match": unir columnas (palabra ↔ significado)
- "listen_type": escuchar audio (ElevenLabs) y escribir lo que se dijo
- "translate": traducir una frase del idioma nativo al inglés

Cada uno: agregar el tipo a types.ts + su componente al Renderer + enseñárselo a Claude vía 
EXERCISE_TYPE_SPECS. El resto del sistema (análisis, generación, guardado, flujo) no cambia.
Eso es lo que el C0.1 te compra.

## NOTA SOBRE COSTOS

Análisis y ejercicios se cachean. Son llamadas chicas a Claude comparadas con ElevenLabs en 
conversación. El audio de teoría (premium) es texto corto, costo bajo. No requiere 
optimización especial al inicio.

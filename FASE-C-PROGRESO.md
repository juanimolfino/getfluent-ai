# Fase C Progreso

Fecha: 2026-06-05

## Implementado

- C0.1 Sistema de tipos extensible de ejercicios en `lib/exercises/types.ts`.
- C1.1 Tablas `conversation_analyses` y `exercise_sets` en Drizzle.
- C1.1 Migración generada: `drizzle/0006_grey_kree.sql`.
- C1.1 RLS manual: `lib/db/fase-c-rls.sql`.
- C1.2 Prompt de análisis en `lib/exercises/analysis-prompt.ts`.
- C1.3 Endpoint `POST /api/conversation/analyze`.
- C1.4 Pantalla real de análisis en `/practice/[sessionId]/analysis`.
- C2.1 Prompt de teoría en `lib/exercises/theory-prompt.ts`.
- C2.2/C3.2 Endpoint `POST /api/exercises/generate` con teoría + ejercicios cacheados.
- C2.3 Pantalla de teoría con audio de ejemplos.
- C3.1 Prompt de ejercicios con `EXERCISE_TYPE_SPECS`.
- C3.3 `ExerciseRenderer` y componentes `multiple_choice`, `fill_blank`, `speak`.
- C3.4 Endpoint `POST /api/exercises/check-speech`.
- C4.1 Resumen y guardado de score con `POST /api/exercises/complete`.

## Pendiente Manual

- Ejecutar `npm run db:migrate` contra la DB objetivo.
- Ejecutar el SQL de `lib/db/fase-c-rls.sql` en Supabase.
- Test end-to-end real con conversación premium, audio y Claude.

## Nota Técnica

El componente `SpeakExercise` usa Web Speech Recognition en browser y fallback de tipeo. El endpoint de corrección hablado valida con Claude usando el weak point real del análisis.

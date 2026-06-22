import type { Exercise } from "@/lib/exercises/types";

function uniqueNonEmpty(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
  });

  return result;
}

function normalizeMultipleChoice(rawExercise: Record<string, unknown>, index: number): Exercise {
  const rawOptions = Array.isArray(rawExercise.options) ? rawExercise.options : [];
  const correctIndex = typeof rawExercise.correctIndex === "number" && Number.isInteger(rawExercise.correctIndex)
    ? rawExercise.correctIndex
    : 0;
  const rawCorrect = rawOptions[correctIndex];
  const correctOption = typeof rawCorrect === "string" && rawCorrect.trim() ? rawCorrect.trim() : "Correct answer";
  const options = uniqueNonEmpty([correctOption, ...rawOptions]);

  const distractors = ["Not quite", "Another option", "Different answer"];
  for (const distractor of distractors) {
    if (options.length >= 3) break;
    options.push(distractor);
  }

  return {
    id: typeof rawExercise.id === "string" && rawExercise.id.trim() ? rawExercise.id.trim() : `multiple-choice-${index + 1}`,
    type: "multiple_choice",
    instruction: typeof rawExercise.instruction === "string" && rawExercise.instruction.trim()
      ? rawExercise.instruction.trim()
      : "Choose the best answer.",
    explanation: typeof rawExercise.explanation === "string" && rawExercise.explanation.trim()
      ? rawExercise.explanation.trim()
      : "The correct answer follows the lesson point.",
    question: typeof rawExercise.question === "string" && rawExercise.question.trim()
      ? rawExercise.question.trim()
      : "Which option is correct?",
    options: options.slice(0, 4),
    correctIndex: 0
  };
}

export function normalizeGeneratedExercises(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((exercise, index) => {
    if (!exercise || typeof exercise !== "object") return exercise;
    const rawExercise = exercise as Record<string, unknown>;
    if (rawExercise.type !== "multiple_choice") return exercise;

    return normalizeMultipleChoice(rawExercise, index);
  });
}

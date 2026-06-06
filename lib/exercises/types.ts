import { z } from "zod";

/**
 * Sistema de tipos de ejercicios. Para agregar un tipo nuevo:
 * 1) agregar a ExerciseType, 2) crear su interfaz + schema Zod, 3) agregarlo al discriminatedUnion
 * y a EXERCISE_TYPE_SPECS, 4) crear su componente en el ExerciseRenderer. Nada más se toca.
 */

export type ExerciseType = "multiple_choice" | "fill_blank" | "speak";

export interface BaseExercise {
  id: string;
  type: ExerciseType;
  instruction: string;
  explanation: string;
}

export interface MultipleChoiceExercise extends BaseExercise {
  type: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
}

export interface FillBlankExercise extends BaseExercise {
  type: "fill_blank";
  sentence: string;
  correctAnswer: string;
  acceptableAnswers?: string[];
}

export interface SpeakExercise extends BaseExercise {
  type: "speak";
  promptText: string;
  exampleAnswer: string;
}

export type Exercise = MultipleChoiceExercise | FillBlankExercise | SpeakExercise;

const baseExerciseSchema = z.object({
  id: z.string().min(1).max(80),
  instruction: z.string().min(1).max(240),
  explanation: z.string().min(1).max(500)
});

export const multipleChoiceExerciseSchema = baseExerciseSchema.extend({
  type: z.literal("multiple_choice"),
  question: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(160)).min(3).max(4),
  correctIndex: z.number().int().min(0).max(3)
});

export const fillBlankExerciseSchema = baseExerciseSchema.extend({
  type: z.literal("fill_blank"),
  sentence: z.string().min(1).max(300).refine((sentence) => sentence.includes("___"), {
    message: "sentence must include ___"
  }),
  correctAnswer: z.string().min(1).max(120),
  acceptableAnswers: z.array(z.string().min(1).max(120)).max(6).optional()
});

export const speakExerciseSchema = baseExerciseSchema.extend({
  type: z.literal("speak"),
  promptText: z.string().min(1).max(320),
  exampleAnswer: z.string().min(1).max(320)
});

const rawExerciseSchema = z.discriminatedUnion("type", [
  multipleChoiceExerciseSchema,
  fillBlankExerciseSchema,
  speakExerciseSchema
]);

export const exerciseSchema: z.ZodType<Exercise> = rawExerciseSchema.superRefine((exercise, context) => {
  if (exercise.type === "multiple_choice" && exercise.correctIndex >= exercise.options.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "correctIndex must point to an existing option",
      path: ["correctIndex"]
    });
  }
});

export const exercisesSchema: z.ZodType<Exercise[]> = z.array(exerciseSchema).min(0).max(10);

export const EXERCISE_TYPE_SPECS: Record<ExerciseType, string> = {
  multiple_choice:
    'multiple_choice: fields id, type="multiple_choice", instruction, explanation, question, options (3-4 strings), correctIndex (0-based index into options).',
  fill_blank:
    'fill_blank: fields id, type="fill_blank", instruction, explanation, sentence (must include ___), correctAnswer (exact text that replaces only ___, not the full phrase around it), optional acceptableAnswers (valid variants).',
  speak:
    'speak: fields id, type="speak", instruction, explanation, promptText (what the learner should say/do), exampleAnswer (one valid spoken response).'
};

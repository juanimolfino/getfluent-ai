import { describe, expect, it } from "vitest";
import { normalizeGeneratedExercises } from "@/lib/exercises/normalize";
import { exercisesSchema } from "@/lib/exercises/types";

describe("normalizeGeneratedExercises", () => {
  it("repairs multiple choice exercises with fewer than three options", () => {
    const normalized = normalizeGeneratedExercises([
      {
        id: "mc-1",
        type: "multiple_choice",
        instruction: "Choose.",
        explanation: "This is correct.",
        question: "Which is correct?",
        options: ["correct", "wrong"],
        correctIndex: 0
      }
    ]);

    const parsed = exercisesSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data[0].type).toBe("multiple_choice");
    if (parsed.data[0].type !== "multiple_choice") return;
    expect(parsed.data[0].options).toHaveLength(3);
    expect(parsed.data[0].correctIndex).toBe(0);
  });

  it("preserves non multiple-choice exercises", () => {
    const fillBlank = {
      id: "fb-1",
      type: "fill_blank",
      instruction: "Complete.",
      explanation: "Use would.",
      sentence: "I ___ go.",
      correctAnswer: "would"
    };

    expect(normalizeGeneratedExercises([fillBlank])).toEqual([fillBlank]);
  });
});

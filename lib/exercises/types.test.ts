import { describe, expect, it } from "vitest";
import { exerciseSchema, EXERCISE_TYPE_SPECS } from "@/lib/exercises/types";

describe("exercise schemas", () => {
  it("validates multiple choice exercises with correctIndex inside options", () => {
    const parsed = exerciseSchema.safeParse({
      id: "mc-1",
      type: "multiple_choice",
      instruction: "Choose the best option.",
      explanation: "It uses the natural past form.",
      question: "Which sentence is natural?",
      options: ["I went home.", "I go home yesterday.", "I going home."],
      correctIndex: 0
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects fill blank exercises without a blank marker", () => {
    const parsed = exerciseSchema.safeParse({
      id: "fb-1",
      type: "fill_blank",
      instruction: "Complete it.",
      explanation: "The sentence needs a blank.",
      sentence: "I went home",
      correctAnswer: "went"
    });

    expect(parsed.success).toBe(false);
  });

  it("exports prompt specs for every supported type", () => {
    expect(Object.keys(EXERCISE_TYPE_SPECS)).toEqual(["multiple_choice", "fill_blank", "speak"]);
  });
});

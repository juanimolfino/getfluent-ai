import { describe, expect, it } from "vitest";
import { buildAnalysisPrompt } from "@/lib/exercises/analysis-prompt";
import { buildExercisesPrompt } from "@/lib/exercises/exercise-prompt";
import { parseJsonObject, stripJsonMarkdown } from "@/lib/exercises/json";
import { buildTheoryPrompt } from "@/lib/exercises/theory-prompt";

const weakPoint = {
  id: "past-tense",
  title: "Past tense",
  category: "grammar" as const,
  explanation: "Use past tense for finished actions.",
  userExample: "Yesterday I go home.",
  betterVersion: "Yesterday I went home."
};

describe("exercise prompts", () => {
  it("builds an analysis prompt that requires JSON only and concrete examples", () => {
    const prompt = buildAnalysisPrompt({
      transcript: "User: Yesterday I go home.",
      englishLevel: "A2",
      topic: "travel",
      interests: ["football"]
    });

    expect(prompt).toContain("Return valid JSON only");
    expect(prompt).toContain("REAL phrase quoted");
    expect(prompt).toContain("A2");
  });

  it("builds a theory prompt with the expected JSON shape", () => {
    const prompt = buildTheoryPrompt({ weakPoint, englishLevel: "B1", interests: ["music"] });

    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"examples"');
    expect(prompt).toContain("30 seconds");
  });

  it("injects exercise specs into the exercise prompt", () => {
    const prompt = buildExercisesPrompt({
      weakPoint,
      theory: { summary: "Use went for finished movement.", examples: ["I went to a concert.", "I went home."] },
      englishLevel: "B1",
      interests: ["music"]
    });

    expect(prompt).toContain("multiple_choice");
    expect(prompt).toContain("fill_blank");
    expect(prompt).toContain("speak");
    expect(prompt).toContain("Return a JSON array only");
  });
});

describe("parseJsonObject", () => {
  it("strips markdown fences", () => {
    expect(stripJsonMarkdown("```json\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
    expect(parseJsonObject("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });
});

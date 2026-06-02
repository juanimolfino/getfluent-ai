import { describe, expect, it } from "vitest";
import { buildConversationSystemPrompt } from "@/lib/conversation/conversation-prompt";

describe("buildConversationSystemPrompt", () => {
  it("tells Alex to keep the conversation alive before the final turn", () => {
    const prompt = buildConversationSystemPrompt({
      englishLevel: "B1",
      nativeLanguage: "spanish",
      topic: "travel",
      targetTurns: 6,
      completedTurns: 5
    });

    expect(prompt).toContain("This is NOT the last turn");
    expect(prompt).toContain("ask another engaging question");
    expect(prompt).toContain("Do not say goodbye");
    expect(prompt).toContain("Do not say goodbye, wrap up, mention finishing, or mention analysis");
    expect(prompt).not.toContain("This IS the final turn");
  });

  it("tells Alex to close only on the final turn", () => {
    const prompt = buildConversationSystemPrompt({
      englishLevel: "B1",
      nativeLanguage: "spanish",
      topic: "travel",
      targetTurns: 6,
      completedTurns: 6
    });

    expect(prompt).toContain("This IS the final turn");
    expect(prompt).toContain("mention they can now see their analysis");
    expect(prompt).toContain("Do not ask another question");
    expect(prompt).not.toContain("This is NOT the last turn");
  });
});

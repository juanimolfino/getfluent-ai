import { describe, expect, it } from "vitest";
import { getConversationFollowUpDelta } from "@/lib/conversation/assistant-response";

describe("getConversationFollowUpDelta", () => {
  it("adds a follow-up question on non-final closed replies", () => {
    expect(getConversationFollowUpDelta("That sounds fun.", false)).toBe(" What do you think?");
  });

  it("does not add a follow-up when the reply already has a question", () => {
    expect(getConversationFollowUpDelta("That sounds fun. Why do you like it?", false)).toBe("");
  });

  it("does not add a follow-up on the final turn", () => {
    expect(getConversationFollowUpDelta("Nice talking with you.", true)).toBe("");
  });
});

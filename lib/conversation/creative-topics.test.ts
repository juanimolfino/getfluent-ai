import { describe, expect, it, vi } from "vitest";
import { CREATIVE_CONVERSATION_TOPICS, pickCreativeConversationTopic } from "@/lib/conversation/creative-topics";

describe("creative conversation topics", () => {
  it("keeps a curated list of 50 topics", () => {
    expect(CREATIVE_CONVERSATION_TOPICS).toHaveLength(50);
    expect(new Set(CREATIVE_CONVERSATION_TOPICS).size).toBe(50);
  });

  it("avoids returning the previous topic when possible", () => {
    const spy = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5);

    const topic = pickCreativeConversationTopic(CREATIVE_CONVERSATION_TOPICS[0]);

    expect(topic).not.toBe(CREATIVE_CONVERSATION_TOPICS[0]);
    spy.mockRestore();
  });
});

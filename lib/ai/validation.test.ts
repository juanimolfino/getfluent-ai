import { describe, expect, it } from "vitest";
import { createJobSchema } from "@/lib/ai/validation";

describe("createJobSchema", () => {
  it("accepts image jobs with a prompt", () => {
    const result = createJobSchema.safeParse({
      type: "image",
      input: { prompt: "Generate a clean product mockup" }
    });

    expect(result.success).toBe(true);
  });

  it("accepts tts jobs with a supported voice", () => {
    const result = createJobSchema.safeParse({
      type: "tts",
      input: { text: "Welcome to the product.", voice: "nova" }
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported job types", () => {
    const result = createJobSchema.safeParse({
      type: "video",
      input: { prompt: "Generate a video" }
    });

    expect(result.success).toBe(false);
  });

  it("rejects too-short prompts", () => {
    const result = createJobSchema.safeParse({
      type: "image",
      input: { prompt: "hi" }
    });

    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { takeElevenLabsSafeChunk } from "@/lib/conversation/elevenlabs-text-buffer";

describe("takeElevenLabsSafeChunk", () => {
  it("keeps an incomplete trailing word in the buffer", () => {
    expect(takeElevenLabsSafeChunk("This is very interes")).toEqual({
      chunk: "This is very ",
      rest: "interes"
    });
  });

  it("uses punctuation as a safe word boundary", () => {
    expect(takeElevenLabsSafeChunk("That is interesting,maybe")).toEqual({
      chunk: "That is interesting,",
      rest: "maybe"
    });
  });

  it("does not flush when the buffer has no safe boundary", () => {
    expect(takeElevenLabsSafeChunk("interesting")).toBeNull();
  });

  it("flushes the remaining text when forced at stream end", () => {
    expect(takeElevenLabsSafeChunk("interesting", true)).toEqual({
      chunk: "interesting",
      rest: ""
    });
  });

  it("flushes a complete short phrase without waiting for the target length", () => {
    expect(takeElevenLabsSafeChunk("Hello there ")).toEqual({
      chunk: "Hello there ",
      rest: ""
    });
  });
});

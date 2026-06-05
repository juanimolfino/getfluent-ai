import { describe, expect, it } from "vitest";
import {
  buildAccumulatedDeepgramTranscript,
  upsertDeepgramTranscriptSegment
} from "@/lib/conversation/deepgram-transcript-accumulator";

describe("Deepgram transcript accumulator", () => {
  it("orders speech segments by turn index", () => {
    const segments = new Map<number, string>();

    upsertDeepgramTranscriptSegment(segments, 2, "and I bought coffee");
    upsertDeepgramTranscriptSegment(segments, 0, "I went to the store");
    upsertDeepgramTranscriptSegment(segments, 1, "yesterday");

    expect(buildAccumulatedDeepgramTranscript(segments)).toBe("I went to the store yesterday and I bought coffee");
  });

  it("replaces only the updated segment", () => {
    const segments = new Map<number, string>();

    upsertDeepgramTranscriptSegment(segments, 0, "I went to the store");
    upsertDeepgramTranscriptSegment(segments, 1, "and I bought coff");
    upsertDeepgramTranscriptSegment(segments, 1, "and I bought coffee");

    expect(buildAccumulatedDeepgramTranscript(segments)).toBe("I went to the store and I bought coffee");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildSttMetricLogLine,
  estimateSttAudioMs,
  normalizeSttMetricText,
  shouldIncrementSttAudioUsage
} from "@/lib/conversation/stt-metrics";

describe("stt metrics", () => {
  it("estimates audio duration from chunk count", () => {
    expect(estimateSttAudioMs(10, 80)).toBe(800);
    expect(estimateSttAudioMs(-1, 80)).toBe(0);
  });

  it("redacts sensitive metric text", () => {
    expect(normalizeSttMetricText("access_token=secret")).toBe("redacted");
    expect(normalizeSttMetricText("Authorization Bearer secret")).toBe("redacted");
    expect(normalizeSttMetricText("audio_base64=abc")).toBe("redacted");
  });

  it("builds a safe structured log line without raw transcript fields", () => {
    const line = buildSttMetricLogLine({
      event: "deepgram_end_of_turn",
      sessionId: "session-1",
      userId: "user-1",
      provider: "deepgram_flux",
      isPremium: true,
      model: "flux-general-en",
      transcriptChars: 42,
      audioMs: 1200,
      postSpeechSilenceMs: 1800,
      eotToSubmitMs: 2200,
      fallbackReason: "access_token=secret"
    });

    expect(line).toContain("[stt-summary]");
    expect(line).toContain("transcriptChars=42");
    expect(line).toContain("audioMs=1200");
    expect(line).toContain("postSpeechSilenceMs=1800");
    expect(line).toContain("eotToSubmitMs=2200");
    expect(line).toContain("fallbackReason=redacted");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("transcript=");
  });

  it("increments STT audio usage only for premium Deepgram final turns", () => {
    expect(
      shouldIncrementSttAudioUsage({
        event: "deepgram_end_of_turn",
        sessionId: "session-1",
        userId: "user-1",
        provider: "deepgram_flux",
        isPremium: true,
        audioMs: 1000
      })
    ).toBe(true);

    expect(
      shouldIncrementSttAudioUsage({
        event: "deepgram_turn_update_first",
        sessionId: "session-1",
        userId: "user-1",
        provider: "deepgram_flux",
        isPremium: true,
        audioMs: 1000
      })
    ).toBe(false);
  });
});

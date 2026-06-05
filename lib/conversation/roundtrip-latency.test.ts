import { describe, expect, it } from "vitest";
import { calculateRoundtripLatency, formatRoundtripLatencyLog } from "@/lib/conversation/roundtrip-latency";

describe("roundtrip latency", () => {
  it("calculates perceived latency from Deepgram EndOfTurn to audible Alex voice", () => {
    const metrics = calculateRoundtripLatency({
      sessionId: "session-1",
      deepgramEndAt: 1000,
      sttEndSource: "deepgram_eot",
      requestStartedAt: 3300,
      voiceStartedAt: 7800,
      requestToBackendReadyMs: 1500,
      requestToFirstTokenMs: 2900,
      requestToFirstAudioChunkMs: 3600
    });

    expect(metrics).toEqual({
      sessionId: "session-1",
      sttEndSource: "deepgram_eot",
      sttEndToAudioMs: 6800,
      sttToRequestMs: 2300,
      requestToBackendReadyMs: 1500,
      requestToTtftMs: 2900,
      requestToAudioChunkMs: 3600,
      ttftToAudioMs: 1600,
      audioChunkToVoiceMs: 900
    });
  });

  it("formats one stable console line for roundtrip logs", () => {
    const line = formatRoundtripLatencyLog({
      sessionId: "session-1",
      sttEndSource: "deepgram_eot",
      sttEndToAudioMs: 6800,
      sttToRequestMs: 2300,
      requestToBackendReadyMs: 1500,
      requestToTtftMs: 2900,
      requestToAudioChunkMs: 3600,
      ttftToAudioMs: 1600,
      audioChunkToVoiceMs: 900
    });

    expect(line).toBe(
      "[latency-roundtrip] turn sessionId=session-1 sttEndSource=deepgram_eot sttEndToAudioMs=6800 sttToRequest=2300 requestToBackendReady=1500 requestToTtft=2900 ttftToAudio=1600 requestToAudioChunk=3600 audioChunkToVoice=900"
    );
  });
});

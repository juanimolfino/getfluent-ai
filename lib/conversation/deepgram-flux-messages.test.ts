import { describe, expect, it, vi } from "vitest";
import { createDeepgramFluxTurnHandler } from "@/lib/conversation/deepgram-flux-messages";

describe("createDeepgramFluxTurnHandler", () => {
  it("emits partial transcript on Update", () => {
    const onPartialTranscript = vi.fn();
    const handler = createDeepgramFluxTurnHandler({
      model: "flux-general-en",
      onPartialTranscript
    });

    handler.handle(JSON.stringify({
      type: "TurnInfo",
      event: "Update",
      turn_index: 1,
      transcript: "I went to London"
    }));

    expect(onPartialTranscript).toHaveBeenCalledWith({
      transcript: "I went to London",
      provider: "deepgram_flux",
      model: "flux-general-en",
      turnIndex: 1
    });
  });

  it("emits final transcript on EndOfTurn", () => {
    const onFinalTranscript = vi.fn();
    const handler = createDeepgramFluxTurnHandler({
      model: "flux-general-en",
      mimeType: "audio/webm;codecs=opus",
      onFinalTranscript
    });

    handler.handle(JSON.stringify({
      type: "TurnInfo",
      event: "EndOfTurn",
      turn_index: 2,
      transcript: "That sounds interesting.",
      end_of_turn_confidence: 0.84,
      audio_window_start: 1,
      audio_window_end: 3.5
    }));

    expect(onFinalTranscript).toHaveBeenCalledWith({
      transcript: "That sounds interesting.",
      turnIndex: 2,
      metadata: {
        provider: "deepgram_flux",
        model: "flux-general-en",
        transcriptChars: 24,
        audioMs: 2500,
        endOfTurnConfidence: 0.84,
        mimeType: "audio/webm;codecs=opus"
      }
    });
  });

  it("ignores empty final transcripts", () => {
    const onFinalTranscript = vi.fn();
    const handler = createDeepgramFluxTurnHandler({
      model: "flux-general-en",
      onFinalTranscript
    });

    handler.handle(JSON.stringify({
      type: "TurnInfo",
      event: "EndOfTurn",
      turn_index: 3,
      transcript: "   "
    }));

    expect(onFinalTranscript).not.toHaveBeenCalled();
  });

  it("deduplicates repeated final transcripts by turn index and text", () => {
    const onFinalTranscript = vi.fn();
    const handler = createDeepgramFluxTurnHandler({
      model: "flux-general-en",
      onFinalTranscript
    });
    const payload = JSON.stringify({
      type: "TurnInfo",
      event: "EndOfTurn",
      turn_index: 4,
      transcript: "I like this topic."
    });

    handler.handle(payload);
    handler.handle(payload);

    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
  });
});

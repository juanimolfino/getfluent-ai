import type {
  FinalTranscriptPayload,
  PartialTranscriptPayload,
  SpeechToTextProviderCallbacks,
  SttProviderMetrics
} from "@/lib/conversation/speech-input";

export type DeepgramFluxTurnInfo = {
  type?: string;
  event?: string;
  turn_index?: number;
  transcript?: string;
  end_of_turn_confidence?: number;
  audio_window_start?: number;
  audio_window_end?: number;
};

export type DeepgramFluxMessage =
  | { kind: "turn_info"; value: DeepgramFluxTurnInfo }
  | { kind: "ignored" };

export type DeepgramFluxTurnHandlerOptions = SpeechToTextProviderCallbacks & {
  model: string;
  mimeType?: string;
};

function getAudioMs(message: DeepgramFluxTurnInfo) {
  if (typeof message.audio_window_start !== "number" || typeof message.audio_window_end !== "number") return undefined;
  return Math.max(0, Math.round((message.audio_window_end - message.audio_window_start) * 1000));
}

export function parseDeepgramFluxMessage(raw: string): DeepgramFluxMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "ignored" };
  }

  if (!parsed || typeof parsed !== "object") return { kind: "ignored" };
  const value = parsed as DeepgramFluxTurnInfo;
  if (value.type !== "TurnInfo") return { kind: "ignored" };
  return { kind: "turn_info", value };
}

export function createDeepgramFluxTurnHandler(options: DeepgramFluxTurnHandlerOptions) {
  const emittedFinals = new Set<string>();

  function emitMetrics(message: DeepgramFluxTurnInfo, transcript: string) {
    const metrics: SttProviderMetrics = {
      provider: "deepgram_flux",
      model: options.model,
      turnIndex: message.turn_index,
      endOfTurnConfidence: message.end_of_turn_confidence,
      transcriptChars: transcript.length,
      audioMs: getAudioMs(message),
      mimeType: options.mimeType
    };
    options.onMetrics?.(metrics);
  }

  return {
    handle(raw: string) {
      const message = parseDeepgramFluxMessage(raw);
      if (message.kind !== "turn_info") return;

      const turnInfo = message.value;
      const transcript = turnInfo.transcript?.trim() ?? "";

      if (turnInfo.event === "Update") {
        if (!transcript) return;
        const payload: PartialTranscriptPayload = {
          transcript,
          provider: "deepgram_flux",
          model: options.model,
          turnIndex: turnInfo.turn_index
        };
        options.onPartialTranscript?.(payload);
        emitMetrics(turnInfo, transcript);
        return;
      }

      if (turnInfo.event !== "EndOfTurn" || !transcript) return;

      const dedupeKey = `${turnInfo.turn_index ?? "unknown"}:${transcript}`;
      if (emittedFinals.has(dedupeKey)) return;
      emittedFinals.add(dedupeKey);

      const payload: FinalTranscriptPayload = {
        transcript,
        turnIndex: turnInfo.turn_index,
        metadata: {
          provider: "deepgram_flux",
          model: options.model,
          transcriptChars: transcript.length,
          audioMs: getAudioMs(turnInfo),
          endOfTurnConfidence: turnInfo.end_of_turn_confidence,
          mimeType: options.mimeType
        }
      };
      options.onFinalTranscript?.(payload);
      emitMetrics(turnInfo, transcript);
    }
  };
}

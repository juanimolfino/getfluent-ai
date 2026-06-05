export type SpeechInputProvider = "browser_speech_recognition" | "deepgram_flux";

export type SttTurnMetadata = {
  provider: SpeechInputProvider;
  model?: string;
  transcriptChars: number;
  audioMs?: number;
  endOfTurnConfidence?: number;
  fallbackReason?: string;
  mimeType?: string;
};

export type FinalTranscriptPayload = {
  transcript: string;
  metadata: SttTurnMetadata;
  turnIndex?: number;
};

export type PartialTranscriptPayload = {
  transcript: string;
  provider: SpeechInputProvider;
  model?: string;
  turnIndex?: number;
};

export type SttProviderMetrics = {
  provider: SpeechInputProvider;
  model?: string;
  tokenFetchMs?: number;
  wsOpenMs?: number;
  firstUpdateLatencyMs?: number;
  audioMs?: number;
  turnIndex?: number;
  endOfTurnConfidence?: number;
  transcriptChars?: number;
  fallbackReason?: string;
  mimeType?: string;
  postSpeechSilenceMs?: number;
  eotToSubmitMs?: number;
};

export type SttProviderError = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type SpeechToTextProvider = {
  start: () => Promise<void>;
  stop: () => Promise<void> | void;
  cancel: () => Promise<void> | void;
  isSupported: () => boolean;
};

export type SpeechToTextProviderCallbacks = {
  onPartialTranscript?: (payload: PartialTranscriptPayload) => void;
  onFinalTranscript?: (payload: FinalTranscriptPayload) => void;
  onError?: (error: SttProviderError) => void;
  onMetrics?: (metrics: SttProviderMetrics) => void;
  onFallback?: (reason: string) => void;
};

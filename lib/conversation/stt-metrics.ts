import type { SpeechInputProvider } from "@/lib/conversation/speech-input";

export const STT_METRIC_EVENTS = [
  "stt_provider_selected",
  "deepgram_token_requested",
  "deepgram_token_granted",
  "deepgram_ws_open",
  "deepgram_ws_close",
  "deepgram_ws_error",
  "deepgram_turn_start",
  "deepgram_turn_update_first",
  "deepgram_end_of_turn",
  "stt_fallback_to_browser"
] as const;

export type SttMetricEvent = typeof STT_METRIC_EVENTS[number];

export type SttMetricLogInput = {
  event: SttMetricEvent;
  sessionId: string;
  userId: string;
  provider: SpeechInputProvider;
  model?: string;
  isPremium: boolean;
  selectedByFlag?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  audioMs?: number;
  transcriptChars?: number;
  endOfTurnConfidence?: number;
  tokenFetchMs?: number;
  wsOpenMs?: number;
  firstUpdateLatencyMs?: number;
  endOfTurnLatencyMs?: number;
  postSpeechSilenceMs?: number;
  eotToSubmitMs?: number;
  deepgramTurnIndex?: number;
  mediaRecorderMimeType?: string;
  errorCode?: string;
};

const SENSITIVE_PATTERN = /(authorization|bearer|secret|api[_-]?key|access[_-]?token|audio[_-]?base64|base64|blob|chunk)=?/i;

export function estimateSttAudioMs(chunkCount: number, chunkDurationMs: number) {
  if (!Number.isFinite(chunkCount) || !Number.isFinite(chunkDurationMs)) return 0;
  return Math.max(0, Math.round(chunkCount * chunkDurationMs));
}

export function normalizeSttMetricText(value: string | undefined, fallback = "unknown") {
  if (!value) return fallback;
  if (SENSITIVE_PATTERN.test(value)) return "redacted";

  const normalized = value
    .trim()
    .slice(0, 120)
    .replace(/[^a-zA-Z0-9_.:/;=+-]/g, "_");

  return normalized || fallback;
}

function formatOptionalField(key: string, value: string | number | boolean | undefined) {
  if (value === undefined) return null;
  return `${key}=${value}`;
}

export function buildSttMetricLogLine(input: SttMetricLogInput) {
  const prefix = input.event === "deepgram_end_of_turn" ? `[stt-summary]` : `[stt-metric]`;
  const fields = [
    prefix,
    `event=${input.event}`,
    `sessionId=${input.sessionId}`,
    `userId=${input.userId}`,
    `provider=${input.provider}`,
    `isPremium=${input.isPremium}`,
    formatOptionalField("model", input.model ? normalizeSttMetricText(input.model) : undefined),
    formatOptionalField("selectedByFlag", input.selectedByFlag),
    formatOptionalField("fallbackUsed", input.fallbackUsed),
    formatOptionalField("fallbackReason", input.fallbackReason ? normalizeSttMetricText(input.fallbackReason) : undefined),
    formatOptionalField("audioMs", input.audioMs),
    formatOptionalField("transcriptChars", input.transcriptChars),
    formatOptionalField("endOfTurnConfidence", input.endOfTurnConfidence),
    formatOptionalField("tokenFetchMs", input.tokenFetchMs),
    formatOptionalField("wsOpenMs", input.wsOpenMs),
    formatOptionalField("firstUpdateLatencyMs", input.firstUpdateLatencyMs),
    formatOptionalField("endOfTurnLatencyMs", input.endOfTurnLatencyMs),
    formatOptionalField("postSpeechSilenceMs", input.postSpeechSilenceMs),
    formatOptionalField("eotToSubmitMs", input.eotToSubmitMs),
    formatOptionalField("deepgramTurnIndex", input.deepgramTurnIndex),
    formatOptionalField(
      "mediaRecorderMimeType",
      input.mediaRecorderMimeType ? normalizeSttMetricText(input.mediaRecorderMimeType) : undefined
    ),
    formatOptionalField("errorCode", input.errorCode ? normalizeSttMetricText(input.errorCode) : undefined)
  ].filter(Boolean);

  return fields.join(" ");
}

export function shouldIncrementSttAudioUsage(input: SttMetricLogInput) {
  const audioMs = input.audioMs;
  return input.isPremium && input.provider === "deepgram_flux" && input.event === "deepgram_end_of_turn" && Number.isInteger(audioMs) && audioMs !== undefined && audioMs > 0;
}

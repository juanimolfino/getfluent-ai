export type RoundtripLatencyInput = {
  sessionId: string;
  deepgramEndAt: number;
  sttEndSource?: "deepgram_eot" | "manual_send";
  requestStartedAt: number | null;
  voiceStartedAt: number;
  requestToBackendReadyMs?: number | null;
  requestToFirstTokenMs?: number | null;
  requestToFirstAudioChunkMs?: number | null;
};

export type RoundtripLatencyMetrics = {
  sessionId: string;
  sttEndSource: "deepgram_eot" | "manual_send";
  sttEndToAudioMs: number;
  sttToRequestMs: number | null;
  requestToBackendReadyMs: number | null;
  requestToTtftMs: number | null;
  requestToAudioChunkMs: number | null;
  ttftToAudioMs: number | null;
  audioChunkToVoiceMs: number | null;
};

function round(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

export function calculateRoundtripLatency(input: RoundtripLatencyInput): RoundtripLatencyMetrics {
  const sttEndToAudioMs = round(input.voiceStartedAt - input.deepgramEndAt) ?? 0;
  const sttToRequestMs = input.requestStartedAt === null ? null : round(input.requestStartedAt - input.deepgramEndAt);
  const requestToVoiceMs = input.requestStartedAt === null ? null : round(input.voiceStartedAt - input.requestStartedAt);
  const requestToTtftMs = round(input.requestToFirstTokenMs);
  const requestToAudioChunkMs = round(input.requestToFirstAudioChunkMs);

  return {
    sessionId: input.sessionId,
    sttEndSource: input.sttEndSource ?? "deepgram_eot",
    sttEndToAudioMs,
    sttToRequestMs,
    requestToBackendReadyMs: round(input.requestToBackendReadyMs),
    requestToTtftMs,
    requestToAudioChunkMs,
    ttftToAudioMs: requestToVoiceMs === null || requestToTtftMs === null ? null : round(requestToVoiceMs - requestToTtftMs),
    audioChunkToVoiceMs: requestToVoiceMs === null || requestToAudioChunkMs === null ? null : round(requestToVoiceMs - requestToAudioChunkMs)
  };
}

function formatMs(value: number | null) {
  return value === null ? "null" : String(value);
}

export function formatRoundtripLatencyLog(metrics: RoundtripLatencyMetrics) {
  return [
    `[latency-roundtrip] turn`,
    `sessionId=${metrics.sessionId}`,
    `sttEndSource=${metrics.sttEndSource}`,
    `sttEndToAudioMs=${metrics.sttEndToAudioMs}`,
    `sttToRequest=${formatMs(metrics.sttToRequestMs)}`,
    `requestToBackendReady=${formatMs(metrics.requestToBackendReadyMs)}`,
    `requestToTtft=${formatMs(metrics.requestToTtftMs)}`,
    `ttftToAudio=${formatMs(metrics.ttftToAudioMs)}`,
    `requestToAudioChunk=${formatMs(metrics.requestToAudioChunkMs)}`,
    `audioChunkToVoice=${formatMs(metrics.audioChunkToVoiceMs)}`
  ].join(" ");
}

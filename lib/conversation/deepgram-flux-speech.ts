"use client";

import { createDeepgramFluxTurnHandler } from "@/lib/conversation/deepgram-flux-messages";
import type {
  SpeechToTextProvider,
  SpeechToTextProviderCallbacks,
  SttProviderMetrics
} from "@/lib/conversation/speech-input";
import { estimateSttAudioMs } from "@/lib/conversation/stt-metrics";

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"];
const AUDIO_TIMESLICE_MS = 80;
const MAX_BUFFERED_AUDIO_CHUNKS = 125;
const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;

type DeepgramTokenResponse = {
  accessToken: string;
  expiresIn: number;
  websocketUrl: string;
  model: string;
  provider: "deepgram_flux";
};

type DeepgramFluxSpeechProviderOptions = SpeechToTextProviderCallbacks & {
  sessionId?: string;
  tokenEndpoint?: string;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string, protocols: string[]) => WebSocket;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  mediaRecorderFactory?: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  isMimeTypeSupported?: (mimeType: string) => boolean;
  now?: () => number;
};

function getDefaultMediaDevices() {
  if (typeof navigator === "undefined") return undefined;
  return navigator.mediaDevices;
}

function getDefaultFetch() {
  if (typeof fetch === "undefined") return undefined;
  return fetch;
}

function getDefaultWebSocketFactory() {
  if (typeof WebSocket === "undefined") return undefined;
  return (url: string, protocols: string[]) => new WebSocket(url, protocols);
}

function getDefaultMediaRecorderFactory() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return (stream: MediaStream, options: MediaRecorderOptions) => new MediaRecorder(stream, options);
}

function defaultMimeTypeSupport(mimeType: string) {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType);
}

function pickSupportedMimeType(isSupported: (mimeType: string) => boolean) {
  return PREFERRED_MIME_TYPES.find((mimeType) => isSupported(mimeType)) ?? null;
}

function isTokenResponse(value: unknown): value is DeepgramTokenResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DeepgramTokenResponse>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.expiresIn === "number" &&
    typeof candidate.websocketUrl === "string" &&
    typeof candidate.model === "string" &&
    candidate.provider === "deepgram_flux"
  );
}

export function createDeepgramFluxSpeechProvider(options: DeepgramFluxSpeechProviderOptions = {}): SpeechToTextProvider {
  const tokenEndpoint = options.tokenEndpoint ?? "/api/stt/deepgram-token";
  const now = options.now ?? (() => performance.now());
  const fetchImpl = options.fetchImpl ?? getDefaultFetch();
  const webSocketFactory = options.webSocketFactory ?? getDefaultWebSocketFactory();
  const mediaDevices = options.mediaDevices ?? getDefaultMediaDevices();
  const mediaRecorderFactory = options.mediaRecorderFactory ?? getDefaultMediaRecorderFactory();
  const isMimeTypeSupported = options.isMimeTypeSupported ?? defaultMimeTypeSupport;

  let socket: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let startedAt = 0;
  let firstUpdateSeen = false;
  let finalTranscriptSeen = false;
  let canceled = false;
  let closing = false;
  let activeMimeType: string | null = null;
  let pendingAudioBuffers: ArrayBuffer[] = [];
  let recordedChunkCount = 0;

  function emitMetrics(metrics: Omit<SttProviderMetrics, "provider">) {
    options.onMetrics?.({ provider: "deepgram_flux", ...metrics });
  }

  function fallback(reason: string) {
    if (canceled) return;
    emitMetrics({
      fallbackReason: reason,
      mimeType: activeMimeType ?? undefined,
      audioMs: estimateSttAudioMs(recordedChunkCount, AUDIO_TIMESLICE_MS)
    });
    options.onFallback?.(reason);
  }

  function error(code: string, message: string) {
    if (canceled) return;
    options.onError?.({ code, message, recoverable: true });
  }

  function cleanup() {
    closing = true;
    pendingAudioBuffers = [];
    mediaRecorder?.stop();
    mediaRecorder = null;

    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;

    if (socket?.readyState === SOCKET_OPEN) {
      socket.send(JSON.stringify({ type: "CloseStream" }));
      socket.close();
    } else if (socket && socket.readyState < SOCKET_CLOSING) {
      socket.close();
    }
    socket = null;
  }

  function providerIsSupported() {
    if (!fetchImpl || !webSocketFactory || !mediaDevices || !mediaRecorderFactory) return false;
    return Boolean(pickSupportedMimeType(isMimeTypeSupported));
  }

  async function fetchToken() {
    if (!fetchImpl) throw new Error("fetch is not available");
    const tokenFetchStartedAt = now();
    const response = await fetchImpl(tokenEndpoint, {
      method: "POST",
      headers: options.sessionId ? { "Content-Type": "application/json" } : undefined,
      body: options.sessionId ? JSON.stringify({ sessionId: options.sessionId }) : undefined
    });
    emitMetrics({ tokenFetchMs: Math.round(now() - tokenFetchStartedAt) });

    if (!response.ok) {
      throw new Error(`token_endpoint_${response.status}`);
    }

    const body = await response.json();
    if (!isTokenResponse(body)) throw new Error("token_response_malformed");
    return body;
  }

  function flushPendingAudio() {
    if (!socket || socket.readyState !== SOCKET_OPEN || !pendingAudioBuffers.length) return;
    const buffers = pendingAudioBuffers;
    pendingAudioBuffers = [];
    buffers.forEach((buffer) => {
      if (socket?.readyState === SOCKET_OPEN) socket.send(buffer);
    });
  }

  function sendOrBufferAudio(buffer: ArrayBuffer) {
    if (canceled) return;
    if (socket?.readyState === SOCKET_OPEN) {
      socket.send(buffer);
      return;
    }

    pendingAudioBuffers.push(buffer);
    if (pendingAudioBuffers.length > MAX_BUFFERED_AUDIO_CHUNKS) pendingAudioBuffers.shift();
  }

  async function startRecording(mimeType: string) {
    if (!mediaDevices || !mediaRecorderFactory) throw new Error("media_recorder_unsupported");
    mediaStream = await mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = mediaRecorderFactory(mediaStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      recordedChunkCount += 1;
      void event.data.arrayBuffer().then((buffer) => {
        sendOrBufferAudio(buffer);
      });
    };

    mediaRecorder.start(AUDIO_TIMESLICE_MS);
  }

  return {
    isSupported() {
      return providerIsSupported();
    },

    async start() {
      canceled = false;
      closing = false;
      finalTranscriptSeen = false;
      firstUpdateSeen = false;
      startedAt = now();
      activeMimeType = pickSupportedMimeType(isMimeTypeSupported);
      recordedChunkCount = 0;

      if (!activeMimeType || !providerIsSupported()) {
        fallback("media_recorder_unsupported");
        return;
      }

      const tokenPromise = fetchToken()
        .then((token): { ok: true; token: DeepgramTokenResponse } => ({ ok: true, token }))
        .catch((tokenError): { ok: false; reason: string } => ({
          ok: false,
          reason: tokenError instanceof Error ? tokenError.message : "token_endpoint_failed"
        }));

      try {
        await startRecording(activeMimeType);
      } catch (recordingError) {
        error("microphone_unavailable", recordingError instanceof Error ? recordingError.message : "Microphone is unavailable");
        fallback("microphone_unavailable");
        cleanup();
        return;
      }

      const tokenResult = await tokenPromise;
      if (!tokenResult.ok) {
        fallback(tokenResult.reason);
        cleanup();
        return;
      }

      if (canceled) return;
      const { token } = tokenResult;

      const handler = createDeepgramFluxTurnHandler({
        model: token.model,
        mimeType: activeMimeType,
        onPartialTranscript: (payload) => {
          if (!firstUpdateSeen) {
            firstUpdateSeen = true;
            emitMetrics({
              firstUpdateLatencyMs: Math.round(now() - startedAt),
              model: token.model,
              mimeType: activeMimeType ?? undefined
            });
          }
          options.onPartialTranscript?.(payload);
        },
        onFinalTranscript: (payload) => {
          finalTranscriptSeen = true;
          options.onFinalTranscript?.({
            ...payload,
            metadata: {
              ...payload.metadata,
              audioMs: payload.metadata.audioMs ?? estimateSttAudioMs(recordedChunkCount, AUDIO_TIMESLICE_MS)
            }
          });
        },
        onMetrics: (metrics) => options.onMetrics?.(metrics)
      });

      const wsOpenStartedAt = now();
      try {
        if (!webSocketFactory) throw new Error("websocket_unsupported");
        socket = webSocketFactory(token.websocketUrl, ["bearer", token.accessToken]);
      } catch {
        fallback("websocket_unsupported");
        return;
      }

      socket.onopen = () => {
        if (canceled) {
          cleanup();
          return;
        }

        emitMetrics({
          wsOpenMs: Math.round(now() - wsOpenStartedAt),
          model: token.model,
          mimeType: activeMimeType ?? undefined
        });
        flushPendingAudio();
      };

      socket.onmessage = (event) => {
        if (canceled) return;
        if (typeof event.data !== "string") return;
        handler.handle(event.data);
      };

      socket.onerror = () => {
        error("deepgram_ws_error", "Deepgram voice input failed.");
        if (!finalTranscriptSeen && !canceled) fallback("deepgram_ws_error");
        cleanup();
      };

      socket.onclose = () => {
        if (!finalTranscriptSeen && !canceled && !closing) fallback("deepgram_ws_closed_before_final");
        cleanup();
      };
    },

    stop() {
      canceled = true;
      cleanup();
    },

    cancel() {
      canceled = true;
      cleanup();
    }
  };
}

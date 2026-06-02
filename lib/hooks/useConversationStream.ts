"use client";

import { useCallback, useRef, useState } from "react";

export type ConversationPhase = "idle" | "user_speaking" | "streaming" | "alex_speaking" | "complete";

export type ServerTurnMetrics = {
  timeToFirstTokenMs: number | null;
  timeToFirstAudioMs?: number | null;
  timeToStreamCompleteMs: number;
  chars: number;
};

export type ClientTurnMetrics = {
  timeToFirstTokenClientMs: number | null;
  timeToVoiceStartMs: number | null;
  timeToStreamCompleteClientMs: number | null;
  server?: ServerTurnMetrics;
};

type StreamDonePayload = {
  fullText: string;
  isComplete: boolean;
  completedTurns: number;
  targetTurns: number;
  metrics: ServerTurnMetrics;
};

export type StreamTimingChar = {
  char: string;
  startMs: number;
  durationMs: number;
};

type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "audio"; chunk: string; seq: number }
  | { type: "timing"; chars: StreamTimingChar[]; startMs: number }
  | { type: "audio_failed" }
  | ({ type: "done" } & StreamDonePayload)
  | { type: "error"; message: string };

type UseConversationStreamOptions = {
  sessionId: string;
  endpoint?: string;
  onTextDelta?: (delta: string, fullText: string) => void;
  onAudio?: (chunk: string, seq: number) => void;
  onTiming?: (chars: StreamTimingChar[], startMs: number) => void;
  onAudioFailed?: () => void;
  onComplete: (payload: StreamDonePayload) => void;
};

export function useConversationStream({
  sessionId,
  endpoint = "/api/conversation/stream",
  onTextDelta,
  onAudio,
  onTiming,
  onAudioFailed,
  onComplete
}: UseConversationStreamOptions) {
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<{ completedTurns: number; targetTurns: number } | null>(null);
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [lastTurnMetrics, setLastTurnMetrics] = useState<ClientTurnMetrics | null>(null);
  const streamingTextRef = useRef("");
  const turnStartedAtRef = useRef<number | null>(null);
  const firstTokenClientMsRef = useRef<number | null>(null);
  const voiceStartClientMsRef = useRef<number | null>(null);
  const streamCompleteClientMsRef = useRef<number | null>(null);
  const callbacksRef = useRef({
    onTextDelta,
    onAudio,
    onTiming,
    onAudioFailed,
    onComplete
  });

  callbacksRef.current = {
    onTextDelta,
    onAudio,
    onTiming,
    onAudioFailed,
    onComplete
  };

  const markVoiceStarted = useCallback(() => {
    if (turnStartedAtRef.current === null) return;
    const timeToVoiceStartMs = Math.round(performance.now() - turnStartedAtRef.current);
    voiceStartClientMsRef.current = timeToVoiceStartMs;
    setLastTurnMetrics((current) => {
      const next = {
        timeToFirstTokenClientMs: current?.timeToFirstTokenClientMs ?? firstTokenClientMsRef.current,
        timeToVoiceStartMs,
        timeToStreamCompleteClientMs: current?.timeToStreamCompleteClientMs ?? streamCompleteClientMsRef.current,
        server: current?.server
      };
      console.log(
        `[latency-client] turn ttft=${next.timeToFirstTokenClientMs ?? "null"}ms voice=${timeToVoiceStartMs}ms complete=${next.timeToStreamCompleteClientMs ?? "null"}ms`
      );
      return next;
    });
  }, []);

  const sendTurn = useCallback(
    async (userText: string) => {
      turnStartedAtRef.current = performance.now();
      firstTokenClientMsRef.current = null;
      voiceStartClientMsRef.current = null;
      streamCompleteClientMsRef.current = null;
      setIsStreaming(true);
      setPhase("streaming");
      setError(null);
      setStreamingText("");
      setLastTurnMetrics(null);
      streamingTextRef.current = "";

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userText })
        });

        if (!response.ok) throw new Error("Alex could not answer. Try again.");
        if (!response.body) throw new Error("Streaming is not available in this browser.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const rawEvent of events) {
            const line = rawEvent.split("\n").find((item) => item.startsWith("data: "));
            if (!line) continue;

            const event = JSON.parse(line.slice(6)) as StreamEvent;
            if (event.type === "text") {
              firstTokenClientMsRef.current ??= Math.round(performance.now() - (turnStartedAtRef.current ?? performance.now()));
              streamingTextRef.current += event.delta;
              setStreamingText(streamingTextRef.current);
              callbacksRef.current.onTextDelta?.(event.delta, streamingTextRef.current);
            }

            if (event.type === "audio") {
              callbacksRef.current.onAudio?.(event.chunk, event.seq);
            }

            if (event.type === "timing") {
              callbacksRef.current.onTiming?.(event.chars, event.startMs);
            }

            if (event.type === "audio_failed") {
              callbacksRef.current.onAudioFailed?.();
            }

            if (event.type === "done") {
              streamCompleteClientMsRef.current = Math.round(performance.now() - (turnStartedAtRef.current ?? performance.now()));
              setSessionProgress({ completedTurns: event.completedTurns, targetTurns: event.targetTurns });
              setLastTurnMetrics((current) => ({
                timeToFirstTokenClientMs: firstTokenClientMsRef.current,
                timeToVoiceStartMs: current?.timeToVoiceStartMs ?? voiceStartClientMsRef.current,
                timeToStreamCompleteClientMs: streamCompleteClientMsRef.current,
                server: event.metrics
              }));
              console.log(
                `[latency-client] turn ttft=${firstTokenClientMsRef.current ?? "null"}ms voice=${voiceStartClientMsRef.current ?? "null"}ms complete=${streamCompleteClientMsRef.current}ms`
              );
              callbacksRef.current.onComplete({
                fullText: event.fullText,
                isComplete: event.isComplete,
                completedTurns: event.completedTurns,
                targetTurns: event.targetTurns,
                metrics: event.metrics
              });
            }

            if (event.type === "error") {
              setError(event.message);
              setPhase("idle");
            }
          }
        }
      } catch (streamError) {
        setError(streamError instanceof Error ? streamError.message : "Something went wrong.");
        setPhase("idle");
      } finally {
        setIsStreaming(false);
      }
    },
    [endpoint, sessionId]
  );

  return {
    sendTurn,
    streamingText,
    isStreaming,
    error,
    sessionProgress,
    lastTurnMetrics,
    markVoiceStarted,
    phase,
    setPhase
  };
}

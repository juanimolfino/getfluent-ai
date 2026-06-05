"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDeepgramFluxSpeechProvider } from "@/lib/conversation/deepgram-flux-speech";
import type { SpeechToTextProvider, SttProviderMetrics } from "@/lib/conversation/speech-input";

type DeepgramSttTestProps = {
  sessionId: string;
};

type TestEvent = {
  label: string;
  detail?: string;
  timestamp: string;
};

function formatMetricDetails(metrics: SttProviderMetrics) {
  return [
    metrics.tokenFetchMs !== undefined ? `token=${metrics.tokenFetchMs}ms` : null,
    metrics.wsOpenMs !== undefined ? `ws=${metrics.wsOpenMs}ms` : null,
    metrics.firstUpdateLatencyMs !== undefined ? `firstUpdate=${metrics.firstUpdateLatencyMs}ms` : null,
    metrics.audioMs !== undefined ? `audio=${metrics.audioMs}ms` : null,
    metrics.transcriptChars !== undefined ? `chars=${metrics.transcriptChars}` : null,
    metrics.endOfTurnConfidence !== undefined ? `confidence=${metrics.endOfTurnConfidence}` : null,
    metrics.fallbackReason ? `fallback=${metrics.fallbackReason}` : null,
    metrics.mimeType ? `mime=${metrics.mimeType}` : null
  ]
    .filter(Boolean)
    .join(" ");
}

export function DeepgramSttTest({ sessionId }: DeepgramSttTestProps) {
  const [status, setStatus] = useState("Idle");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<TestEvent[]>([]);
  const providerRef = useRef<SpeechToTextProvider | null>(null);
  const partialCountRef = useRef(0);

  function appendEvent(label: string, detail?: string) {
    setEvents((current) => [
      {
        label,
        detail,
        timestamp: new Date().toLocaleTimeString()
      },
      ...current
    ].slice(0, 12));
  }

  function stopTest() {
    providerRef.current?.cancel();
    providerRef.current = null;
    setIsRunning(false);
    setStatus("Stopped");
    appendEvent("Stopped");
  }

  async function runTest() {
    stopTest();
    setStatus("Starting mic, token, and WebSocket");
    setPartialTranscript("");
    setFinalTranscript("");
    setEvents([]);
    partialCountRef.current = 0;
    setIsRunning(true);

    const provider = createDeepgramFluxSpeechProvider({
      sessionId,
      onPartialTranscript: ({ transcript }) => {
        partialCountRef.current += 1;
        setPartialTranscript(transcript);
        setStatus("Receiving partial transcript");
        if (partialCountRef.current === 1) appendEvent("First partial transcript", `${transcript.length} chars`);
      },
      onFinalTranscript: ({ transcript, metadata }) => {
        setFinalTranscript(transcript);
        setStatus("EndOfTurn received");
        appendEvent("Final transcript", `${metadata.transcriptChars} chars`);
        providerRef.current?.cancel();
        providerRef.current = null;
        setIsRunning(false);
      },
      onError: (error) => {
        setStatus(`Recoverable error: ${error.code}`);
        appendEvent("Error", `${error.code} recoverable=${error.recoverable}`);
      },
      onFallback: (reason) => {
        setStatus(`Fallback would run: ${reason}`);
        appendEvent("Fallback", reason);
        providerRef.current = null;
        setIsRunning(false);
      },
      onMetrics: (metrics) => {
        const details = formatMetricDetails(metrics);
        if (metrics.tokenFetchMs !== undefined) appendEvent("Token granted", details);
        if (metrics.wsOpenMs !== undefined) {
          setStatus("WebSocket open. Speak now.");
          appendEvent("WebSocket open", details);
        }
        if (metrics.firstUpdateLatencyMs !== undefined) appendEvent("First update", details);
        if (metrics.fallbackReason) appendEvent("Fallback metric", details);
      }
    });

    if (!provider.isSupported()) {
      setIsRunning(false);
      setStatus("Deepgram browser capture is not supported here");
      appendEvent("Unsupported", "MediaRecorder, WebSocket, fetch, or Opus container missing");
      return;
    }

    providerRef.current = provider;
    appendEvent("Session", sessionId);
    appendEvent("Starting", "Recording begins locally while token and WebSocket connect");

    try {
      await provider.start();
      if (providerRef.current === provider) setStatus("Recording locally. Waiting for WebSocket open.");
    } catch (error) {
      providerRef.current = null;
      setIsRunning(false);
      setStatus("Deepgram test failed to start");
      appendEvent("Start failed", error instanceof Error ? error.message : "unknown");
    }
  }

  useEffect(() => {
    return () => {
      providerRef.current?.cancel();
    };
  }, []);

  return (
    <section className="rounded-lg border bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deepgram STT test</h1>
          <p className="mt-1 text-sm text-muted-foreground">{status}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={runTest} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            Start test
          </Button>
          <Button type="button" variant="outline" onClick={stopTest} disabled={!isRunning}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium text-muted-foreground">Partial transcript</p>
          <p className="mt-2 min-h-20 text-sm leading-6">{partialTranscript || "Waiting..."}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium text-muted-foreground">Final transcript</p>
          <p className="mt-2 min-h-20 text-sm leading-6">{finalTranscript || "Waiting..."}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-background p-4">
        <p className="text-sm font-medium text-muted-foreground">Events</p>
        <div className="mt-2 space-y-2 text-sm">
          {events.length ? (
            events.map((event, index) => (
              <div key={`${event.timestamp}-${event.label}-${index}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-medium">{event.label}</span>
                <span className="text-muted-foreground">{event.timestamp}</span>
                {event.detail ? <span className="break-all text-muted-foreground">{event.detail}</span> : null}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No events yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

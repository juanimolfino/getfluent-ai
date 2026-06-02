"use client";

import { useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserVoicePlayer, type VoicePlayer } from "@/lib/conversation/browser-voice";
import { createPremiumVoicePlayer, type PremiumTimingChar, type PremiumVoicePlayer } from "@/lib/conversation/premium-voice";

type PremiumAudioTestProps = {
  sessionId: string;
};

type PremiumStreamEvent =
  | { type: "text"; delta: string }
  | { type: "audio"; chunk: string; seq: number }
  | { type: "timing"; chars: PremiumTimingChar[]; startMs: number }
  | { type: "audio_failed" }
  | { type: "done"; fullText: string }
  | { type: "error"; message: string };

export function PremiumAudioTest({ sessionId }: PremiumAudioTestProps) {
  const [streamingText, setStreamingText] = useState("");
  const [revealedText, setRevealedText] = useState("");
  const [status, setStatus] = useState("Idle");
  const [isRunning, setIsRunning] = useState(false);
  const playerRef = useRef<PremiumVoicePlayer | null>(null);
  const fallbackVoiceRef = useRef<VoicePlayer | null>(null);
  const startedPlaybackRef = useRef(false);
  const didFallbackRef = useRef(false);
  const fallbackSpokenRef = useRef(false);
  const streamDoneRef = useRef(false);
  const streamedTextRef = useRef("");
  const noAudioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearNoAudioTimer() {
    if (!noAudioTimerRef.current) return;
    clearTimeout(noAudioTimerRef.current);
    noAudioTimerRef.current = null;
  }

  function speakFallback(text: string) {
    if (fallbackSpokenRef.current || !text.trim()) return;
    fallbackSpokenRef.current = true;
    setRevealedText(text);
    const fallbackVoice = createBrowserVoicePlayer();
    fallbackVoiceRef.current = fallbackVoice;
    fallbackVoice.onStart(() => setStatus("Playing browser voice fallback"));
    fallbackVoice.onEnd(() => setStatus("Browser voice fallback ended"));
    fallbackVoice.speak(text);
  }

  function fallbackToBrowserVoice(reason: string) {
    if (didFallbackRef.current) return;
    didFallbackRef.current = true;
    clearNoAudioTimer();
    console.warn(`[premium-audio-fallback] ${reason}`);
    setStatus(`Fallback queued: ${reason}`);
    playerRef.current?.stop();

    // Browser speech is cleaner with the complete sentence, so wait for done if the text is still streaming.
    if (streamDoneRef.current) speakFallback(streamedTextRef.current);
  }

  function armNoAudioTimer() {
    if (noAudioTimerRef.current || startedPlaybackRef.current || didFallbackRef.current) return;
    noAudioTimerRef.current = setTimeout(() => {
      if (!startedPlaybackRef.current) fallbackToBrowserVoice("no audio chunk within 2s");
    }, 2000);
  }

  async function runTest() {
    setIsRunning(true);
    setStatus("Starting premium stream");
    setStreamingText("");
    setRevealedText("");
    startedPlaybackRef.current = false;
    didFallbackRef.current = false;
    fallbackSpokenRef.current = false;
    streamDoneRef.current = false;
    streamedTextRef.current = "";
    clearNoAudioTimer();
    fallbackVoiceRef.current?.stop();

    const player = createPremiumVoicePlayer();
    playerRef.current = player;
    player.onReveal(setRevealedText);
    player.onStart(() => setStatus("Playing premium audio"));
    player.onEnd(() => setStatus("Premium audio ended"));
    player.onError((error) => fallbackToBrowserVoice(error.message));

    try {
      const response = await fetch("/api/conversation/stream-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userText: "This is a premium audio playback test." })
      });

      if (!response.ok || !response.body) throw new Error(`Premium stream failed with ${response.status}`);

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

          const event = JSON.parse(line.slice(6)) as PremiumStreamEvent;
          if (event.type === "text") {
            streamedTextRef.current += event.delta;
            setStreamingText(streamedTextRef.current);
            player.setText(streamedTextRef.current);
            armNoAudioTimer();
          }
          if (event.type === "audio") {
            clearNoAudioTimer();
            if (!startedPlaybackRef.current) {
              startedPlaybackRef.current = true;
              player.speak(streamedTextRef.current);
            }
            if (!didFallbackRef.current) player.enqueueAudio(event.chunk, event.seq);
          }
          if (event.type === "timing") {
            if (!didFallbackRef.current) player.addTimings(event.chars);
          }
          if (event.type === "done") {
            streamDoneRef.current = true;
            streamedTextRef.current = event.fullText;
            setStreamingText(event.fullText);
            player.setText(event.fullText);
            if (didFallbackRef.current) speakFallback(event.fullText);
          }
          if (event.type === "audio_failed") {
            fallbackToBrowserVoice("audio_failed event");
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Test failed");
      player.stop();
    } finally {
      clearNoAudioTimer();
      setIsRunning(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Premium audio test</h1>
          <p className="mt-1 text-sm text-muted-foreground">{status}</p>
        </div>
        <Button type="button" onClick={runTest} disabled={isRunning}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run test
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium text-muted-foreground">Streamed text</p>
          <p className="mt-2 text-sm leading-6">{streamingText || "Waiting..."}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium text-muted-foreground">Revealed by audio</p>
          <p className="mt-2 text-sm leading-6">{revealedText || "Waiting..."}</p>
        </div>
      </div>
    </section>
  );
}

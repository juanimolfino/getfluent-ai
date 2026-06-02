"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, Mic, Send, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserVoicePlayer, type VoicePlayer } from "@/lib/conversation/browser-voice";
import { createPremiumVoicePlayer, type PremiumTimingChar, type PremiumVoicePlayer } from "@/lib/conversation/premium-voice";
import { useConversationStream, type StreamTimingChar } from "@/lib/hooks/useConversationStream";
import type { ConversationTurn, EnglishLevel } from "@/lib/db/schema";

const START_CONVERSATION_TEXT = "[START_CONVERSATION]";
const SILENCE_BEFORE_SEND_MS = 3000;
const VOICE_SPEEDS = [
  { label: "Slow", value: 0.7 },
  { label: "Normal", value: 0.95 },
  { label: "Fast", value: 1.1 }
];

type ConversationViewProps = {
  sessionId: string;
  topic: string;
  englishLevel: EnglishLevel;
  targetTurns: number;
  completedTurns: number;
  isComplete: boolean;
  isPremium: boolean;
  initialTurns: ConversationTurn[];
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionEvent = {
  results: {
    length: number;
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

type PremiumGoodbyeAudio = {
  chunks: { chunk: string; seq: number }[];
  timings: PremiumTimingChar[];
};

type PremiumReplayChunk = {
  chunk: string;
  seq: number;
};

function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

function createPremiumReplayBlob(chunks: PremiumReplayChunk[]) {
  const orderedBuffers = [...chunks]
    .sort((first, second) => first.seq - second.seq)
    .map((item) => base64ToArrayBuffer(item.chunk));
  return new Blob(orderedBuffers, { type: "audio/mpeg" });
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function ConversationView({
  sessionId,
  topic,
  englishLevel,
  targetTurns,
  completedTurns,
  isComplete,
  isPremium,
  initialTurns
}: ConversationViewProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>(initialTurns);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState({ completedTurns, targetTurns, isComplete });
  const [localError, setLocalError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [voiceRate, setVoiceRate] = useState(0.95);
  const [isEnding, setIsEnding] = useState(false);
  const [premiumRevealedText, setPremiumRevealedText] = useState("");
  const [premiumLiveBubbleActive, setPremiumLiveBubbleActive] = useState(false);
  const browserPlayerRef = useRef<VoicePlayer | null>(null);
  const premiumPlayerRef = useRef<PremiumVoicePlayer | null>(null);
  const premiumFallbackVoiceRef = useRef<VoicePlayer | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const shouldSendOnEndRef = useRef(false);
  const speechDraftRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const noPremiumAudioTimerRef = useRef<number | null>(null);
  const startedInitialStreamRef = useRef(false);
  const pendingCompletionRef = useRef(false);
  const currentAssistantTextRef = useRef("");
  const premiumPlaybackStartedRef = useRef(false);
  const premiumFallbackRef = useRef(false);
  const premiumFallbackSpokenRef = useRef(false);
  const premiumStreamDoneRef = useRef(false);
  const premiumPendingTimingsRef = useRef<PremiumTimingChar[]>([]);
  const pendingAssistantTurnRef = useRef<ConversationTurn | null>(null);
  const suppressPremiumFallbackSpeechRef = useRef(false);
  const currentPremiumAudioChunksRef = useRef<PremiumReplayChunk[]>([]);
  const premiumReplayAudioByTurnRef = useRef<Map<string, Blob>>(new Map());
  const premiumReplayElementRef = useRef<HTMLAudioElement | null>(null);
  const premiumReplayObjectUrlRef = useRef<string | null>(null);

  const streamEndpoint = isPremium ? "/api/conversation/stream-premium" : "/api/conversation/stream";

  const {
    sendTurn,
    streamingText,
    isStreaming,
    error: streamError,
    sessionProgress,
    lastTurnMetrics,
    markVoiceStarted,
    phase,
    setPhase
  } = useConversationStream({
    sessionId,
    endpoint: streamEndpoint,
    onTextDelta: handleStreamTextDelta,
    onAudio: handleStreamAudio,
    onTiming: handleStreamTiming,
    onAudioFailed: handleStreamAudioFailed,
    onComplete: ({ fullText, isComplete: completed, completedTurns: nextCompletedTurns, targetTurns: nextTargetTurns }) => {
      const assistantTurn: ConversationTurn = {
        role: "assistant",
        content: fullText,
        timestamp: new Date().toISOString()
      };
      setProgress({ completedTurns: nextCompletedTurns, targetTurns: nextTargetTurns, isComplete: completed });
      pendingCompletionRef.current = completed;

      if (isPremium) {
        pendingAssistantTurnRef.current = assistantTurn;
        premiumStreamDoneRef.current = true;
        currentAssistantTextRef.current = fullText;
        premiumPlayerRef.current?.setText(fullText);
        if (!premiumFallbackRef.current) {
          storePremiumReplayAudio(assistantTurn.timestamp, currentPremiumAudioChunksRef.current);
        }

        if (premiumFallbackRef.current) {
          speakPremiumFallback(fullText);
          return;
        }

        if (!premiumPlaybackStartedRef.current) {
          fallbackToBrowserVoice("premium stream ended before audio started");
          return;
        }

        if (!premiumPlayerRef.current?.isSpeaking()) {
          finishAssistantAudioPhase();
        }
        return;
      }

      setTurns((current) => [...current, assistantTurn]);
      setPhase("alex_speaking");
      browserPlayerRef.current?.speak(fullText);
    }
  });

  function clearPremiumAudioTimer() {
    if (noPremiumAudioTimerRef.current === null) return;
    window.clearTimeout(noPremiumAudioTimerRef.current);
    noPremiumAudioTimerRef.current = null;
  }

  function resetPremiumTurnState() {
    clearPremiumAudioTimer();
    stopPremiumReplayAudio();
    currentAssistantTextRef.current = "";
    premiumPlaybackStartedRef.current = false;
    premiumFallbackRef.current = false;
    premiumFallbackSpokenRef.current = false;
    premiumStreamDoneRef.current = false;
    premiumPendingTimingsRef.current = [];
    pendingAssistantTurnRef.current = null;
    suppressPremiumFallbackSpeechRef.current = false;
    currentPremiumAudioChunksRef.current = [];
    setPremiumLiveBubbleActive(false);
    setPremiumRevealedText("");
    premiumPlayerRef.current?.stop();
    premiumFallbackVoiceRef.current?.stop();
  }

  function storePremiumReplayAudio(turnKey: string, chunks: PremiumReplayChunk[]) {
    if (!isPremium || !chunks.length) return;
    premiumReplayAudioByTurnRef.current.set(turnKey, createPremiumReplayBlob(chunks));
  }

  function stopPremiumReplayAudio() {
    premiumReplayElementRef.current?.pause();
    premiumReplayElementRef.current?.removeAttribute("src");
    premiumReplayElementRef.current?.load();
    premiumReplayElementRef.current = null;

    if (premiumReplayObjectUrlRef.current) {
      URL.revokeObjectURL(premiumReplayObjectUrlRef.current);
      premiumReplayObjectUrlRef.current = null;
    }
  }

  function replayWithBrowserVoice(turn: ConversationTurn) {
    pendingCompletionRef.current = progress.isComplete;
    setPhase("alex_speaking");
    browserPlayerRef.current?.speak(turn.content);
  }

  function playPremiumReplayBlob(blob: Blob, fallbackTurn: ConversationTurn) {
    stopPremiumReplayAudio();
    browserPlayerRef.current?.stop();
    premiumPlayerRef.current?.stop();
    premiumFallbackVoiceRef.current?.stop();

    pendingCompletionRef.current = progress.isComplete;
    setPhase("alex_speaking");

    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    premiumReplayObjectUrlRef.current = objectUrl;
    premiumReplayElementRef.current = audio;

    audio.onended = () => {
      stopPremiumReplayAudio();
      setPhase(pendingCompletionRef.current ? "complete" : "idle");
      pendingCompletionRef.current = false;
    };
    audio.onerror = () => {
      stopPremiumReplayAudio();
      replayWithBrowserVoice(fallbackTurn);
    };

    void audio.play().catch(() => {
      stopPremiumReplayAudio();
      replayWithBrowserVoice(fallbackTurn);
    });
  }

  function replayAssistantTurn(turn: ConversationTurn) {
    if (phase === "streaming" || phase === "alex_speaking") return;

    const premiumReplayBlob = isPremium ? premiumReplayAudioByTurnRef.current.get(turn.timestamp) : null;
    if (premiumReplayBlob) {
      playPremiumReplayBlob(premiumReplayBlob, turn);
      return;
    }

    replayWithBrowserVoice(turn);
  }

  function commitPendingAssistantTurn() {
    const pendingTurn = pendingAssistantTurnRef.current;
    if (pendingTurn) {
      pendingAssistantTurnRef.current = null;
      setTurns((current) => [...current, pendingTurn]);
    }
    setPremiumLiveBubbleActive(false);
  }

  function finishAssistantAudioPhase() {
    commitPendingAssistantTurn();
    setPhase(pendingCompletionRef.current ? "complete" : "idle");
    pendingCompletionRef.current = false;
  }

  function armPremiumAudioTimer() {
    if (!isPremium || noPremiumAudioTimerRef.current !== null || premiumPlaybackStartedRef.current || premiumFallbackRef.current) return;
    noPremiumAudioTimerRef.current = window.setTimeout(() => {
      if (!premiumPlaybackStartedRef.current) fallbackToBrowserVoice("no audio chunk within 2s");
    }, 2000);
  }

  function speakPremiumFallback(fullText: string) {
    if (premiumFallbackSpokenRef.current || !fullText.trim()) return;

    premiumFallbackSpokenRef.current = true;
    setPremiumRevealedText(fullText);
    setPhase("alex_speaking");

    const fallbackVoice = createBrowserVoicePlayer();
    fallbackVoice.setRate(voiceRate);
    fallbackVoice.onStart(markVoiceStarted);
    fallbackVoice.onEnd(finishAssistantAudioPhase);
    premiumFallbackVoiceRef.current = fallbackVoice;
    fallbackVoice.speak(fullText);
  }

  function fallbackToBrowserVoice(reason: string) {
    if (!isPremium || premiumFallbackRef.current) return;

    premiumFallbackRef.current = true;
    clearPremiumAudioTimer();
    console.warn(`[premium-audio-fallback] conversation sessionId=${sessionId} reason=${reason}`);
    premiumPlayerRef.current?.stop();
    setPremiumLiveBubbleActive(true);
    setPremiumRevealedText(currentAssistantTextRef.current);

    if (suppressPremiumFallbackSpeechRef.current) {
      finishAssistantAudioPhase();
      return;
    }

    // Browser speech sounds cleaner with the full answer, so if text is still streaming we wait for done.
    if (premiumStreamDoneRef.current) speakPremiumFallback(currentAssistantTextRef.current);
  }

  function handleStreamTextDelta(_delta: string, fullText: string) {
    if (!isPremium) return;
    currentAssistantTextRef.current = fullText;
    premiumPlayerRef.current?.setText(fullText);
    if (premiumFallbackRef.current) setPremiumRevealedText(fullText);
    armPremiumAudioTimer();
  }

  function handleStreamAudio(chunk: string, seq: number) {
    if (!isPremium || premiumFallbackRef.current) return;

    clearPremiumAudioTimer();
    const player = premiumPlayerRef.current;
    if (!player) return;

    if (!premiumPlaybackStartedRef.current) {
      premiumPlaybackStartedRef.current = true;
      setPremiumLiveBubbleActive(true);
      player.speak(currentAssistantTextRef.current);
      if (premiumPendingTimingsRef.current.length) {
        player.addTimings(premiumPendingTimingsRef.current);
        premiumPendingTimingsRef.current = [];
      }
    }

    currentPremiumAudioChunksRef.current.push({ chunk, seq });
    player.enqueueAudio(chunk, seq);
  }

  function handleStreamTiming(chars: StreamTimingChar[]) {
    if (!isPremium || premiumFallbackRef.current) return;

    const timingChars = chars.map((item) => ({
      char: item.char,
      startMs: item.startMs,
      durationMs: item.durationMs
    }));

    if (premiumPlaybackStartedRef.current) {
      premiumPlayerRef.current?.addTimings(timingChars);
      return;
    }

    premiumPendingTimingsRef.current = [...premiumPendingTimingsRef.current, ...timingChars];
  }

  function handleStreamAudioFailed() {
    fallbackToBrowserVoice("audio_failed event");
  }

  const stopListening = useCallback((shouldSend: boolean) => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    shouldSendOnEndRef.current = shouldSend;
    listeningRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const submitUserText = useCallback(
    async (userText: string) => {
      if (!userText || isStreaming || phase === "alex_speaking" || progress.isComplete) return;
      setText("");
      setLocalError(null);
      const userTurn: ConversationTurn = {
        role: "user",
        content: userText,
        timestamp: new Date().toISOString()
      };
      setTurns((current) => [...current, userTurn]);
      if (isPremium) resetPremiumTurnState();
      await sendTurn(userText);
    },
    [isPremium, isStreaming, phase, progress.isComplete, sendTurn]
  );

  const startListening = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setSpeechSupported(false);
      setLocalError("Voice input is not available in this browser. You can type your answer.");
      textareaRef.current?.focus();
      return;
    }

    browserPlayerRef.current?.stop();
    premiumPlayerRef.current?.stop();
    premiumFallbackVoiceRef.current?.stop();
    stopPremiumReplayAudio();
    setLocalError(null);
    setText("");
    speechDraftRef.current = "";
    shouldSendOnEndRef.current = false;
    listeningRef.current = true;
    setPhase("user_speaking");

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const nextText = transcript.trim();
      speechDraftRef.current = nextText;
      setText(nextText);

      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      if (nextText) {
        silenceTimerRef.current = window.setTimeout(() => stopListening(true), SILENCE_BEFORE_SEND_MS);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setLocalError("I could not hear that clearly. Try again or type your answer.");
      }
    };

    recognition.onend = () => {
      if (listeningRef.current && !shouldSendOnEndRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          listeningRef.current = false;
        }
      }

      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const shouldSend = shouldSendOnEndRef.current;
      shouldSendOnEndRef.current = false;
      recognitionRef.current = null;

      const userText = speechDraftRef.current.trim();
      speechDraftRef.current = "";

      if (shouldSend && userText) {
        void submitUserText(userText);
      } else {
        setPhase(progress.isComplete ? "complete" : "idle");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [progress.isComplete, setPhase, stopListening, submitUserText]);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
    browserPlayerRef.current = createBrowserVoicePlayer();
    browserPlayerRef.current.setRate(voiceRate);
    browserPlayerRef.current.onStart(markVoiceStarted);
    browserPlayerRef.current.onEnd(() => {
      setPhase(pendingCompletionRef.current ? "complete" : "idle");
      pendingCompletionRef.current = false;
    });

    premiumPlayerRef.current = createPremiumVoicePlayer();
    premiumPlayerRef.current.onReveal(setPremiumRevealedText);
    premiumPlayerRef.current.onStart(() => {
      markVoiceStarted();
      setPhase("alex_speaking");
    });
    premiumPlayerRef.current.onEnd(finishAssistantAudioPhase);
    premiumPlayerRef.current.onError((error) => fallbackToBrowserVoice(error.message));

    return () => {
      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      clearPremiumAudioTimer();
      recognitionRef.current?.abort();
      browserPlayerRef.current?.stop();
      premiumPlayerRef.current?.stop();
      premiumFallbackVoiceRef.current?.stop();
      stopPremiumReplayAudio();
    };
  }, [markVoiceStarted, setPhase]);

  useEffect(() => {
    browserPlayerRef.current?.setRate(voiceRate);
    premiumFallbackVoiceRef.current?.setRate(voiceRate);
  }, [voiceRate]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streamingText, premiumRevealedText]);

  useEffect(() => {
    if (initialTurns.length > 0 || startedInitialStreamRef.current) return;
    startedInitialStreamRef.current = true;
    if (isPremium) resetPremiumTurnState();
    void sendTurn(START_CONVERSATION_TEXT);
  }, [initialTurns.length, isPremium, sendTurn]);

  useEffect(() => {
    if (!sessionProgress) return;
    setProgress((current) => ({
      ...current,
      completedTurns: sessionProgress.completedTurns,
      targetTurns: sessionProgress.targetTurns
    }));
  }, [sessionProgress]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitUserText(text.trim());
  }

  async function handleEndConversation() {
    if (phase === "streaming" || phase === "alex_speaking" || phase === "complete" || isEnding) return;

    setIsEnding(true);
    setLocalError(null);

    try {
      const response = await fetch("/api/conversation/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, includePremiumAudio: isPremium })
      });

      if (!response.ok) throw new Error("Could not end the conversation. Try again.");

      const data = (await response.json()) as {
        turn?: ConversationTurn;
        premiumAudio?: PremiumGoodbyeAudio | null;
        session: { completedTurns: number; targetTurns: number; isComplete: boolean };
      };

      setProgress(data.session);

      if (data.turn) {
        if (isPremium && data.premiumAudio?.chunks.length) {
          resetPremiumTurnState();
          storePremiumReplayAudio(data.turn.timestamp, data.premiumAudio.chunks);
          suppressPremiumFallbackSpeechRef.current = true;
          pendingAssistantTurnRef.current = data.turn;
          pendingCompletionRef.current = true;
          currentAssistantTextRef.current = data.turn.content;
          premiumPlaybackStartedRef.current = true;
          premiumStreamDoneRef.current = true;
          setPremiumLiveBubbleActive(true);
          setPhase("alex_speaking");

          const player = premiumPlayerRef.current;
          if (player) {
            player.speak(data.turn.content);
            if (data.premiumAudio.timings.length) player.addTimings(data.premiumAudio.timings);
            data.premiumAudio.chunks.forEach((audioChunk) => {
              player.enqueueAudio(audioChunk.chunk, audioChunk.seq);
            });
          } else {
            finishAssistantAudioPhase();
          }
          return;
        }

        setTurns((current) => [...current, data.turn as ConversationTurn]);
        if (isPremium) {
          setPhase("complete");
        } else {
          pendingCompletionRef.current = true;
          setPhase("alex_speaking");
          browserPlayerRef.current?.speak(data.turn.content);
        }
      } else {
        setPhase("complete");
      }
    } catch (endError) {
      setLocalError(endError instanceof Error ? endError.message : "Something went wrong.");
    } finally {
      setIsEnding(false);
    }
  }

  const error = localError ?? streamError;
  const disableUserInput = phase === "streaming" || phase === "alex_speaking" || phase === "complete" || progress.isComplete;
  const liveAssistantText = isPremium
    ? premiumFallbackRef.current
      ? premiumRevealedText || streamingText
      : premiumPlaybackStartedRef.current
        ? premiumRevealedText
        : ""
    : streamingText;
  const showStreamingBubble = isPremium
    ? premiumLiveBubbleActive && Boolean(liveAssistantText) && (isStreaming || phase === "alex_speaking")
    : isStreaming && Boolean(liveAssistantText);
  const showThinkingBubble = isPremium ? isStreaming && !liveAssistantText : isStreaming && !streamingText;
  const showCompleteScreen = (phase === "complete" || progress.isComplete) && !premiumLiveBubbleActive;

  return (
    <div className="grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-lg border bg-white p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <p className="text-sm font-medium text-muted-foreground">Practice session</p>
        <h1 className="mt-2 text-3xl font-semibold capitalize">{topic}</h1>
        <div className="mt-6 space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Level</p>
            <p className="mt-1 font-medium">{englishLevel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Progress</p>
            <p className="mt-1 font-medium">
              {progress.completedTurns} / {progress.targetTurns} user turns
            </p>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.min(100, (progress.completedTurns / progress.targetTurns) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="mt-1 font-medium">{phase === "complete" || progress.isComplete ? "Completed" : "Active"}</p>
          </div>
          {!isPremium ? (
            <div>
              <p className="text-muted-foreground">Voice speed</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {VOICE_SPEEDS.map((speed) => (
                  <button
                    key={speed.value}
                    type="button"
                    onClick={() => setVoiceRate(speed.value)}
                    className={`h-9 rounded-md border px-2 text-xs font-medium transition-colors ${
                      voiceRate === speed.value ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-muted"
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive/40 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={phase === "streaming" || phase === "alex_speaking" || phase === "complete" || isEnding}
            onClick={handleEndConversation}
          >
            {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            End conversation
          </Button>
        </div>
      </aside>

      <main className="flex min-h-[calc(100vh-3rem)] flex-col rounded-lg border bg-white">
        <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {turns.map((turn, index) => (
            <div key={`${turn.timestamp}-${index}`} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                  turn.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                <div className="flex items-start gap-3">
                  <p>{turn.content}</p>
                  {turn.role === "assistant" ? (
                    <button
                      type="button"
                      onClick={() => replayAssistantTurn(turn)}
                      disabled={phase === "streaming" || phase === "alex_speaking"}
                      className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-white disabled:opacity-40"
                      aria-label="Play audio"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {showStreamingBubble ? (
            <div className="flex justify-start">
              <div className="max-w-[82%] rounded-lg bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                {liveAssistantText}
                <span className="ml-0.5 inline-block animate-pulse">|</span>
              </div>
            </div>
          ) : null}

          {showThinkingBubble ? (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Alex is replying
              </div>
            </div>
          ) : null}

          {showCompleteScreen ? (
            <div className="rounded-lg border bg-background p-4">
              <p className="font-medium">Session complete</p>
              <p className="mt-1 text-sm text-muted-foreground">Review your conversation and choose what to improve next.</p>
              <Button asChild className="mt-4">
                <Link href={`/practice/${sessionId}/analysis`}>
                  <BarChart3 className="h-4 w-4" />
                  See my analysis
                </Link>
              </Button>
            </div>
          ) : null}

          {process.env.NODE_ENV === "development" && lastTurnMetrics ? (
            <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
              Client TTFT: {lastTurnMetrics.timeToFirstTokenClientMs ?? "n/a"}ms · Voice: {lastTurnMetrics.timeToVoiceStartMs ?? "n/a"}ms · Complete:{" "}
              {lastTurnMetrics.timeToStreamCompleteClientMs ?? "n/a"}ms
              {lastTurnMetrics.server ? (
                <>
                  {" "}
                  · Server TTFT: {lastTurnMetrics.server.timeToFirstTokenMs ?? "n/a"}ms
                  {lastTurnMetrics.server.timeToFirstAudioMs !== undefined ? <> · TTF audio: {lastTurnMetrics.server.timeToFirstAudioMs ?? "n/a"}ms</> : null} · Chars:{" "}
                  {lastTurnMetrics.server.chars}
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t p-4 md:p-6">
          {error ? <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-col gap-3 md:flex-row">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={disableUserInput || phase === "user_speaking"}
              placeholder={phase === "complete" || progress.isComplete ? "Session completed" : phase === "user_speaking" ? "Listening..." : "Reply in English..."}
              className="min-h-[84px] resize-none"
            />
            <div className="grid grid-cols-2 gap-3 md:w-40 md:grid-cols-1">
              <Button
                type="button"
                size="lg"
                variant={phase === "user_speaking" ? "outline" : "default"}
                disabled={(disableUserInput && phase !== "user_speaking") || !speechSupported}
                onClick={phase === "user_speaking" ? () => stopListening(true) : startListening}
                className="h-12 md:h-[40px]"
              >
                {phase === "user_speaking" ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {phase === "user_speaking" ? "Send" : "Answer"}
              </Button>
              <Button type="submit" size="lg" variant="outline" disabled={disableUserInput || phase === "user_speaking" || !text.trim()} className="h-12 md:h-[40px]">
                {isStreaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Send
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  createDeepgramFluxSpeechProvider,
  fetchDeepgramFluxToken,
  type DeepgramFluxToken
} from "@/lib/conversation/deepgram-flux-speech";
import type { SpeechToTextProvider } from "@/lib/conversation/speech-input";
import type { SpeakExercise as SpeakExerciseType } from "@/lib/exercises/types";

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type Props = {
  sessionId: string;
  analysisId: string;
  weakPointId: string;
  exercise: SpeakExerciseType;
  onComplete: (correct: boolean) => void;
};

type SpeechFeedback = {
  correct: boolean;
  feedback: string;
  correctedVersion: string;
};

type DeepgramTokenCache = {
  token?: DeepgramFluxToken;
  promise?: Promise<DeepgramFluxToken>;
  expiresAt?: number;
};

const DEEPGRAM_PREFETCH_MIN_TOKEN_MS = 5000;

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function isDeepgramFluxInputSupported() {
  if (typeof window === "undefined") return false;
  try {
    return createDeepgramFluxSpeechProvider().isSupported();
  } catch {
    return false;
  }
}

export function SpeakExercise({ sessionId, analysisId, weakPointId, exercise, onComplete }: Props) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const deepgramRef = useRef<SpeechToTextProvider | null>(null);
  const deepgramTokenCacheRef = useRef<DeepgramTokenCache>({});
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<SpeechFeedback | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startBrowserListening() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError("Speech recognition is not available in this browser. You can type your answer.");
      return false;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let next = "";
      for (let index = 0; index < event.results.length; index += 1) {
        next += event.results[index][0].transcript;
      }
      setTranscript(next.trim());
    };
    recognition.onerror = () => {
      setError("Speech recognition stopped. Try again or type your answer.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
    return true;
  }

  const warmDeepgramToken = useCallback(() => {
    if (!isDeepgramFluxInputSupported()) return undefined;

    const cache = deepgramTokenCacheRef.current;
    const now = performance.now();
    if (cache.token && cache.expiresAt && cache.expiresAt - now > DEEPGRAM_PREFETCH_MIN_TOKEN_MS) {
      return Promise.resolve(cache.token);
    }
    if (cache.promise) return cache.promise;

    const promise = fetchDeepgramFluxToken({ sessionId })
      .then((token) => {
        if (deepgramTokenCacheRef.current.promise === promise) {
          deepgramTokenCacheRef.current = {
            token,
            expiresAt: performance.now() + token.expiresIn * 1000
          };
        }
        return token;
      })
      .catch((tokenError) => {
        if (deepgramTokenCacheRef.current.promise === promise) deepgramTokenCacheRef.current = {};
        throw tokenError;
      });

    deepgramTokenCacheRef.current = { promise };
    void promise.catch(() => {});
    return promise;
  }, [sessionId]);

  function consumeDeepgramPrefetchedToken() {
    const cache = deepgramTokenCacheRef.current;
    const now = performance.now();

    if (cache.token && cache.expiresAt && cache.expiresAt - now > DEEPGRAM_PREFETCH_MIN_TOKEN_MS) {
      const token = cache.token;
      deepgramTokenCacheRef.current = {};
      return Promise.resolve(token);
    }

    if (cache.promise) {
      const promise = cache.promise;
      deepgramTokenCacheRef.current = {};
      return promise;
    }

    return undefined;
  }

  useEffect(() => {
    warmDeepgramToken();
    return () => {
      deepgramTokenCacheRef.current = {};
    };
  }, [warmDeepgramToken]);

  async function startDeepgramListening() {
    setError(null);
    const deepgram = createDeepgramFluxSpeechProvider({
      sessionId,
      prefetchedTokenPromise: consumeDeepgramPrefetchedToken(),
      onPartialTranscript(payload) {
        setTranscript(payload.transcript);
      },
      onFinalTranscript(payload) {
        setTranscript(payload.transcript);
        setIsListening(false);
      },
      onFallback() {
        deepgramRef.current = null;
        if (!startBrowserListening()) setIsListening(false);
      },
      onError(sttError) {
        setError(sttError.message);
      }
    });

    if (!deepgram.isSupported()) {
      startBrowserListening();
      return;
    }

    deepgramRef.current = deepgram;
    setIsListening(true);
    try {
      await deepgram.start();
    } catch {
      deepgramRef.current = null;
      setIsListening(false);
      if (!startBrowserListening()) setError("Speech recognition stopped. Try again or type your answer.");
    }
  }

  function startListening() {
    void startDeepgramListening();
  }

  function stopListening() {
    deepgramRef.current?.stop();
    deepgramRef.current = null;
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  async function checkSpeech() {
    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/exercises/check-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          weakPointId,
          exerciseId: exercise.id,
          transcript,
          instruction: exercise.instruction
        })
      });
      if (!response.ok) throw new Error("Could not check your answer.");
      const data = (await response.json()) as { feedback: SpeechFeedback };
      setFeedback(data.feedback);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Something went wrong.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-purple-700">{exercise.instruction}</p>
        <h2 className="mt-2 text-2xl font-semibold">{exercise.promptText}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Example: {exercise.exampleAnswer}</p>
      </div>

      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        className="min-h-28 w-full rounded-2xl border px-4 py-3 text-base outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
        placeholder="Speak, or type your answer here..."
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className="inline-flex items-center gap-2 rounded-full border bg-white px-5 py-2.5 text-sm font-semibold"
        >
          {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isListening ? "Stop" : "Speak"}
        </button>
        <button
          type="button"
          disabled={!transcript.trim() || isChecking}
          onClick={checkSpeech}
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {isChecking ? "Checking..." : "Check"}
        </button>
      </div>

      {error ? <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}

      {feedback ? (
        <div className={`rounded-2xl border p-4 ${feedback.correct ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}`}>
          <p className="font-semibold">{feedback.correct ? "Good spoken answer." : "Almost there."}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{feedback.feedback}</p>
          <p className="mt-3 text-sm">
            <b>Better version:</b> {feedback.correctedVersion}
          </p>
          <button
            type="button"
            onClick={() => onComplete(feedback.correct)}
            className="mt-4 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

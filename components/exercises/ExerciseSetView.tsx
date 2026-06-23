"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { createBrowserVoicePlayer, type VoicePlayer } from "@/lib/conversation/browser-voice";
import type { ExerciseSet } from "@/lib/db/schema";
import { ExerciseRenderer } from "@/components/exercises/ExerciseRenderer";

type Props = {
  sessionId: string;
  analysisId: string;
  weakPointId: string;
  initialExerciseSet: ExerciseSet | null;
};

type GenerateResponse = {
  exerciseSet: ExerciseSet;
};

type Step = "theory" | "exercises" | "summary";
type TheoryTranslation = {
  translation: string;
  targetLanguage: string;
};
type ExerciseProgress = {
  exerciseSetId: string;
  exerciseCount: number;
  step: Step;
  currentIndex: number;
  score: number;
};

const exerciseSetCache = new Map<string, ExerciseSet>();
const exerciseSetRequestCache = new Map<string, Promise<ExerciseSet>>();
const audioUrlCache = new Map<string, string>();
const translationCache = new Map<string, TheoryTranslation>();
const progressStoragePrefix = "getfluent:exercise-progress:";

function scoreMessage(score: number, total: number) {
  const percent = total ? score / total : 0;
  if (percent >= 0.85) return "Excellent. This point is becoming natural.";
  if (percent >= 0.6) return "Good progress. A little more practice will make it stick.";
  return "Good start. This is exactly the kind of point that improves with repetition.";
}

function getProgressStorageKey(cacheKey: string) {
  return `${progressStoragePrefix}${cacheKey}`;
}

function readStoredProgress(cacheKey: string, exerciseSet: ExerciseSet) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getProgressStorageKey(cacheKey));
    if (!raw) return null;
    const progress = JSON.parse(raw) as Partial<ExerciseProgress>;
    const validStep = progress.step === "theory" || progress.step === "exercises" || progress.step === "summary";
    if (
      progress.exerciseSetId !== exerciseSet.id ||
      progress.exerciseCount !== exerciseSet.exercises.length ||
      !validStep ||
      typeof progress.currentIndex !== "number" ||
      typeof progress.score !== "number"
    ) {
      return null;
    }

    const step = progress.step as Step;
    return {
      step,
      currentIndex: Math.min(Math.max(0, progress.currentIndex), Math.max(0, exerciseSet.exercises.length - 1)),
      score: Math.min(Math.max(0, progress.score), exerciseSet.exercises.length)
    };
  } catch {
    return null;
  }
}

function writeStoredProgress(cacheKey: string, exerciseSet: ExerciseSet, progress: Omit<ExerciseProgress, "exerciseSetId" | "exerciseCount">) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getProgressStorageKey(cacheKey),
      JSON.stringify({
        ...progress,
        exerciseSetId: exerciseSet.id,
        exerciseCount: exerciseSet.exercises.length
      })
    );
  } catch {
    // Progress persistence is best-effort; the practice flow still works without localStorage.
  }
}

export function ExerciseSetView({ sessionId, analysisId, weakPointId, initialExerciseSet }: Props) {
  const voiceRef = useRef<VoicePlayer | null>(null);
  const cacheKey = `${analysisId}:${weakPointId}`;
  const cachedInitialSet = initialExerciseSet ?? exerciseSetCache.get(cacheKey) ?? null;
  const [exerciseSet, setExerciseSet] = useState<ExerciseSet | null>(cachedInitialSet);
  const [step, setStep] = useState<Step>("theory");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(!cachedInitialSet);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<TheoryTranslation | null>(translationCache.get(cacheKey) ?? null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  useEffect(() => {
    setStep("theory");
    setCurrentIndex(0);
    setScore(0);
    setShowTranslation(false);
    setHasRestoredProgress(false);
  }, [cacheKey]);

  useEffect(() => {
    voiceRef.current = createBrowserVoicePlayer();
    return () => voiceRef.current?.stop();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = initialExerciseSet ?? exerciseSetCache.get(cacheKey);
    if (cached) {
      exerciseSetCache.set(cacheKey, cached);
      setExerciseSet(cached);
      setIsLoading(false);
      return;
    }

    async function loadSet() {
      setIsLoading(true);
      setError(null);

      try {
        let request = exerciseSetRequestCache.get(cacheKey);
        if (!request) {
          request = fetch("/api/exercises/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analysisId, weakPointId })
          }).then(async (response) => {
            if (!response.ok) throw new Error("Could not generate the practice set.");
            const data = (await response.json()) as GenerateResponse;
            exerciseSetCache.set(cacheKey, data.exerciseSet);
            return data.exerciseSet;
          }).finally(() => {
            exerciseSetRequestCache.delete(cacheKey);
          });
          exerciseSetRequestCache.set(cacheKey, request);
        }

        const nextExerciseSet = await request;
        if (!cancelled) setExerciseSet(nextExerciseSet);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSet();
    return () => {
      cancelled = true;
    };
  }, [analysisId, weakPointId, cacheKey, initialExerciseSet]);

  useEffect(() => {
    if (!exerciseSet || hasRestoredProgress) return;
    const progress = readStoredProgress(cacheKey, exerciseSet);
    if (progress) {
      setStep(progress.step);
      setCurrentIndex(progress.currentIndex);
      setScore(progress.score);
    }
    setHasRestoredProgress(true);
  }, [cacheKey, exerciseSet, hasRestoredProgress]);

  useEffect(() => {
    if (!exerciseSet || !hasRestoredProgress) return;
    writeStoredProgress(cacheKey, exerciseSet, { step, currentIndex, score });
  }, [cacheKey, currentIndex, exerciseSet, hasRestoredProgress, score, step]);

  useEffect(() => {
    if (!exerciseSet || translationCache.has(cacheKey)) return;
    let cancelled = false;

    async function loadTranslation() {
      try {
        const response = await fetch("/api/exercises/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysisId,
            weakPointId,
            summary: exerciseSet?.theory.summary,
            examples: exerciseSet?.theory.examples ?? []
          })
        });
        if (!response.ok) return;

        const data = (await response.json()) as TheoryTranslation;
        translationCache.set(cacheKey, data);
        if (!cancelled) setTranslation(data);
      } catch {
        // Translation is optional; the lesson remains usable in English.
      }
    }

    void loadTranslation();
    return () => {
      cancelled = true;
    };
  }, [analysisId, weakPointId, cacheKey, exerciseSet]);

  async function playExample(text: string) {
    try {
      const cachedUrl = audioUrlCache.get(text);
      if (cachedUrl) {
        await new Audio(cachedUrl).play();
        return;
      }

      const response = await fetch("/api/exercises/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, weakPointId, text })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        audioUrlCache.set(text, url);
        const audio = new Audio(url);
        await audio.play();
        return;
      }
    } catch {
      // Fall back to browser voice below.
    }

    voiceRef.current?.speak(text);
  }

  async function saveScore(finalScore: number) {
    if (!exerciseSet) return;
    setIsSaving(true);

    try {
      await fetch("/api/exercises/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseSetId: exerciseSet.id, score: finalScore })
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExerciseComplete(correct: boolean) {
    if (!exerciseSet) return;
    const nextScore = correct ? score + 1 : score;
    setScore(nextScore);

    if (currentIndex >= exerciseSet.exercises.length - 1) {
      await saveScore(nextScore);
      setStep("summary");
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  function startExercises() {
    setStep("exercises");
    if (exerciseSet) writeStoredProgress(cacheKey, exerciseSet, { step: "exercises", currentIndex, score });
  }

  if (isLoading) {
    return (
      <section className="rounded-3xl border bg-white p-8 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-purple-700" />
        <h1 className="mt-4 text-3xl font-semibold">Building your mini lesson...</h1>
        <p className="mt-3 text-sm text-muted-foreground">Claude is turning your conversation into theory and exercises.</p>
      </section>
    );
  }

  if (error || !exerciseSet) {
    return (
      <section className="rounded-3xl border border-red-100 bg-red-50 p-8">
        <h1 className="text-3xl font-semibold text-red-950">{error ?? "Practice set not found."}</h1>
      </section>
    );
  }

  if (step === "summary") {
    return (
      <section className="rounded-3xl border bg-gradient-to-br from-emerald-50 to-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">Practice complete</p>
        <h1 className="mt-3 text-4xl font-semibold">
          {score} / {exerciseSet.exercises.length}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          {scoreMessage(score, exerciseSet.exercises.length)}
        </p>
        {isSaving ? <p className="mt-3 text-xs text-muted-foreground">Saving score...</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/practice" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Practice again
          </Link>
          <Link href={`/practice/${sessionId}/analysis`} className="rounded-full border bg-white px-5 py-3 text-sm font-semibold">
            Review analysis
          </Link>
        </div>
      </section>
    );
  }

  if (step === "exercises") {
    const exercise = exerciseSet.exercises[currentIndex];

    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 text-sm font-semibold text-muted-foreground">
            <span>
              {currentIndex + 1} of {exerciseSet.exercises.length}
            </span>
            <span>{score} correct</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-orange-500"
              style={{ width: `${((currentIndex + 1) / exerciseSet.exercises.length) * 100}%` }}
            />
          </div>
        </div>
        <ExerciseRenderer
          key={exercise.id}
          sessionId={sessionId}
          analysisId={analysisId}
          weakPointId={weakPointId}
          exercise={exercise}
          onComplete={handleExerciseComplete}
        />
      </section>
    );
  }

  return (
    <section className="rounded-3xl border bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold text-purple-700">Mini lesson</p>
      <h1 className="mt-3 text-3xl font-semibold">Learn this in 30 seconds</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{exerciseSet.theory.summary}</p>
      {translation ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowTranslation((value) => !value)}
            className="rounded-full border bg-white px-4 py-2 text-sm font-semibold"
          >
            {showTranslation ? "Hide translation" : `Read in ${translation.targetLanguage}`}
          </button>
          {showTranslation ? (
            <p className="mt-3 rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
              {translation.translation}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {exerciseSet.theory.examples.map((example) => (
          <div key={example} className="flex items-center justify-between gap-4 rounded-2xl border bg-slate-50 p-4">
            <p className="text-sm font-semibold">{example}</p>
            <button
              type="button"
              onClick={() => void playExample(example)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm"
            >
              <Volume2 className="h-4 w-4" />
              Listen
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={startExercises}
        className="mt-8 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
      >
        Start exercises
      </button>
    </section>
  );
}

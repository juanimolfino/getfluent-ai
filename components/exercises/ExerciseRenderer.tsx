"use client";

import type { Exercise } from "@/lib/exercises/types";
import { FillBlankExercise } from "@/components/exercises/FillBlankExercise";
import { MultipleChoiceExercise } from "@/components/exercises/MultipleChoiceExercise";
import { SpeakExercise } from "@/components/exercises/SpeakExercise";

type Props = {
  sessionId: string;
  analysisId: string;
  weakPointId: string;
  exercise: Exercise;
  onComplete: (correct: boolean) => void;
};

export function ExerciseRenderer({ sessionId, analysisId, weakPointId, exercise, onComplete }: Props) {
  switch (exercise.type) {
    case "multiple_choice":
      return <MultipleChoiceExercise exercise={exercise} onComplete={onComplete} />;
    case "fill_blank":
      return <FillBlankExercise exercise={exercise} onComplete={onComplete} />;
    case "speak":
      return <SpeakExercise sessionId={sessionId} analysisId={analysisId} weakPointId={weakPointId} exercise={exercise} onComplete={onComplete} />;
    default:
      return (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">This exercise type is not supported yet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">You can continue with the next exercise.</p>
          <button type="button" onClick={() => onComplete(false)} className="mt-4 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
            Next
          </button>
        </div>
      );
  }
}

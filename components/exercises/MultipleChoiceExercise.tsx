"use client";

import { useState } from "react";
import type { MultipleChoiceExercise as MultipleChoiceExerciseType } from "@/lib/exercises/types";

type Props = {
  exercise: MultipleChoiceExerciseType;
  onComplete: (correct: boolean) => void;
};

export function MultipleChoiceExercise({ exercise, onComplete }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isDone = submitted;
  const correct = selected === exercise.correctIndex;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-purple-700">{exercise.instruction}</p>
        <h2 className="mt-2 text-2xl font-semibold">{exercise.question}</h2>
      </div>
      <div className="grid gap-3">
        {exercise.options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrect = index === exercise.correctIndex;
          const stateClass = isDone
            ? isCorrect
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : isSelected
              ? "border-red-200 bg-red-50 text-red-950"
              : "border-slate-200 bg-white"
            : isSelected
              ? "border-purple-500 bg-purple-50 text-purple-950 ring-4 ring-purple-100"
              : "border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50";

          return (
            <button
              key={option}
              type="button"
              disabled={isDone}
              onClick={() => setSelected(index)}
              className={`rounded-2xl border p-4 text-left text-sm font-semibold transition ${stateClass}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {!isDone ? (
        <button
          type="button"
          disabled={selected === null}
          onClick={() => setSubmitted(true)}
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      ) : null}
      {isDone ? (
        <div className="rounded-2xl border bg-slate-50 p-4">
          <p className="font-semibold">{correct ? "Correct." : "Almost."}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{exercise.explanation}</p>
          <button
            type="button"
            onClick={() => onComplete(correct)}
            className="mt-4 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

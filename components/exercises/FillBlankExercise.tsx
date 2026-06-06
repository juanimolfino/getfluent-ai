"use client";

import { useState } from "react";
import type { FillBlankExercise as FillBlankExerciseType } from "@/lib/exercises/types";

type Props = {
  exercise: FillBlankExerciseType;
  onComplete: (correct: boolean) => void;
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function inferBlankAnswer(sentence: string, correctAnswer: string) {
  const [, afterBlank = ""] = sentence.split("___");
  const answerWords = correctAnswer.trim().split(/\s+/);

  for (let count = 1; count < answerWords.length; count += 1) {
    const blankCandidate = answerWords.slice(0, count).join(" ");
    const remainingCandidate = answerWords.slice(count).join(" ");
    if (remainingCandidate && normalize(afterBlank).startsWith(normalize(remainingCandidate))) {
      return blankCandidate;
    }
  }

  return correctAnswer;
}

export function FillBlankExercise({ exercise, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const expectedBlankAnswer = inferBlankAnswer(exercise.sentence, exercise.correctAnswer);
  const validAnswers = [exercise.correctAnswer, expectedBlankAnswer, ...(exercise.acceptableAnswers ?? [])].map(normalize);
  const correct = validAnswers.includes(normalize(answer));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-purple-700">{exercise.instruction}</p>
        <h2 className="mt-2 text-2xl font-semibold">Complete the sentence</h2>
      </div>
      <p className="rounded-2xl border bg-slate-50 p-5 text-xl font-semibold leading-8">
        {exercise.sentence.split("___").map((part, index, parts) => (
          <span key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="mx-2 rounded-lg bg-white px-4 py-1 text-purple-700">___</span> : null}
          </span>
        ))}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
        className="space-y-3"
      >
        <input
          value={answer}
          disabled={submitted}
          onChange={(event) => setAnswer(event.target.value)}
          className="w-full rounded-2xl border px-4 py-3 text-lg outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
          placeholder="Type your answer"
        />
        {!submitted ? (
          <button type="submit" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
            Check
          </button>
        ) : null}
      </form>
      {submitted ? (
        <div className={`rounded-2xl border p-4 ${correct ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}>
          <p className="font-semibold">{correct ? "Correct." : `Almost. The answer is "${expectedBlankAnswer}".`}</p>
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

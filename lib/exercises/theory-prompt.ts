import type { EnglishLevel } from "@/lib/db/schema";
import type { WeakPoint } from "@/lib/exercises/analysis";

type TheoryPromptConfig = {
  weakPoint: WeakPoint;
  englishLevel: EnglishLevel;
  interests: string[];
};

export function buildTheoryPrompt(config: TheoryPromptConfig) {
  const interests = config.interests.length ? config.interests.join(", ") : "everyday conversation";

  return `You are an empathetic English teacher creating a tiny Duolingo-style lesson.

Learner level: ${config.englishLevel}
Learner interests: ${interests}

Weak point:
- Title: ${config.weakPoint.title}
- Category: ${config.weakPoint.category}
- Explanation: ${config.weakPoint.explanation}
- Learner said: ${config.weakPoint.userExample}
- Better version: ${config.weakPoint.betterVersion}

Create a mini-lesson:
- summary: maximum 3-4 short sentences. Use simple language adapted to ${config.englishLevel}. No jargon.
- examples: 2-3 clear examples, themed around the learner interests when possible.
- Tone: warm, direct, encouraging. It should be understandable in 30 seconds.
- If the learner is A1 or A2, use very short sentences, very common words, and one idea per sentence. Assume they may not understand grammar terms.
- If the learner is B1 or higher, keep it concise but more natural.

Return valid JSON only. No markdown.
Shape:
{
  "summary": "...",
  "examples": ["...", "...", "..."]
}`;
}

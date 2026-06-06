import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { getConversationAnalysisById } from "@/lib/db/fluent-queries";
import { parseJsonObject } from "@/lib/exercises/json";

const checkSpeechSchema = z.object({
  analysisId: z.string().uuid(),
  weakPointId: z.string().min(1).max(80),
  exerciseId: z.string().min(1).max(80),
  transcript: z.string().min(1).max(1200),
  instruction: z.string().min(1).max(300)
});

const speechFeedbackSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().min(1).max(600),
  correctedVersion: z.string().min(1).max(500)
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = checkSpeechSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const analysis = await getConversationAnalysisById(parsed.data.analysisId, user.id);
    if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

    const weakPoint = analysis.weakPoints.find((item) => item.id === parsed.data.weakPointId);
    if (!weakPoint) return NextResponse.json({ error: "Weak point not found" }, { status: 404 });

    const prompt = `You are checking a spoken English practice answer.

Weak point:
- Title: ${weakPoint.title}
- Category: ${weakPoint.category}
- Explanation: ${weakPoint.explanation}
- Original learner example: ${weakPoint.userExample}
- Better version: ${weakPoint.betterVersion}

Exercise instruction: ${parsed.data.instruction}
Exercise id: ${parsed.data.exerciseId}
Learner said: ${parsed.data.transcript}

Did the learner apply this weak point correctly enough for practice?
Return valid JSON only:
{
  "correct": true,
  "feedback": "encouraging, specific feedback",
  "correctedVersion": "a natural corrected version"
}`;

    const message = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 700,
      system: "Return only valid JSON. Do not include markdown or commentary.",
      messages: [{ role: "user", content: prompt }]
    });

    let json: unknown;
    try {
      json = parseJsonObject(extractTextFromMessage(message));
    } catch (error) {
      console.error("Speech feedback JSON parse failed", error);
      return NextResponse.json({ error: "Could not parse speech feedback" }, { status: 502 });
    }

    const feedback = speechFeedbackSchema.safeParse(json);
    if (!feedback.success) {
      console.error("Speech feedback validation failed", feedback.error.flatten());
      return NextResponse.json({ error: "Speech feedback did not match the expected format" }, { status: 502 });
    }

    return NextResponse.json({ feedback: feedback.data });
  } catch (error) {
    console.error("Speech check failed", error);
    return NextResponse.json({ error: "Could not check speech" }, { status: 500 });
  }
}

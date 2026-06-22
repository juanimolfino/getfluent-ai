import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { getSessionState, hasPaidConversationCredit } from "@/lib/conversation/session-state";
import {
  createExerciseSet,
  getConversationAnalysisById,
  getExerciseSetByWeakPoint,
  getUserLanguageProfile
} from "@/lib/db/fluent-queries";
import { theorySchema } from "@/lib/exercises/analysis";
import { buildExercisesPrompt } from "@/lib/exercises/exercise-prompt";
import { parseJsonObject } from "@/lib/exercises/json";
import { normalizeGeneratedExercises } from "@/lib/exercises/normalize";
import { buildTheoryPrompt } from "@/lib/exercises/theory-prompt";
import { exercisesSchema } from "@/lib/exercises/types";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import { enforceExpensiveEndpointRateLimit, enforceMonthlyUsageLimit } from "@/lib/http/rate-limit";

const generateSchema = z.object({
  analysisId: z.string().uuid(),
  weakPointId: z.string().min(1).max(80)
});

export async function POST(request: Request) {
  try {
    const originResponse = rejectForbiddenOrigin(request, "exercises_generate");
    if (originResponse) return originResponse;

    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimitResponse = await enforceExpensiveEndpointRateLimit({ userId: user.id, kind: "exercise_generation" });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const analysis = await getConversationAnalysisById(parsed.data.analysisId, user.id);
    if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

    const session = await getSessionState(analysis.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!hasPaidConversationCredit(session)) {
      return NextResponse.json({ error: "No paid conversation credit found for this session" }, { status: 402 });
    }

    const cached = await getExerciseSetByWeakPoint({
      analysisId: parsed.data.analysisId,
      weakPointId: parsed.data.weakPointId,
      userId: user.id
    });
    if (cached) return NextResponse.json({ exerciseSet: cached });

    const weakPoint = analysis.weakPoints.find((item) => item.id === parsed.data.weakPointId);
    if (!weakPoint) return NextResponse.json({ error: "Weak point not found" }, { status: 404 });

    const monthlyUsageResponse = await enforceMonthlyUsageLimit({ userId: user.id, kind: "exercise_generation" });
    if (monthlyUsageResponse) return monthlyUsageResponse;

    const languageProfile = await getUserLanguageProfile(user.id);
    const englishLevel = languageProfile?.englishLevel ?? "B1";
    const interests = languageProfile?.interests ?? [];

    const theoryMessage = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 700,
      system: "Return only valid JSON. Do not include markdown or commentary.",
      messages: [{ role: "user", content: buildTheoryPrompt({ weakPoint, englishLevel, interests }) }]
    });

    let theoryJson: unknown;
    try {
      theoryJson = parseJsonObject(extractTextFromMessage(theoryMessage));
    } catch (error) {
      console.error("Theory JSON parse failed", error);
      return NextResponse.json({ error: "Could not parse theory" }, { status: 502 });
    }

    const theory = theorySchema.safeParse(theoryJson);
    if (!theory.success) {
      console.error("Theory validation failed", theory.error.flatten());
      return NextResponse.json({ error: "Theory did not match the expected format" }, { status: 502 });
    }

    const exercisesMessage = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 2200,
      system: "Return only valid JSON. Do not include markdown or commentary.",
      messages: [{ role: "user", content: buildExercisesPrompt({ weakPoint, theory: theory.data, englishLevel, interests }) }]
    });

    let exercisesJson: unknown;
    try {
      exercisesJson = parseJsonObject(extractTextFromMessage(exercisesMessage));
    } catch (error) {
      console.error("Exercises JSON parse failed", error);
      return NextResponse.json({ error: "Could not parse exercises" }, { status: 502 });
    }

    const normalizedExercisesJson = normalizeGeneratedExercises(exercisesJson);
    if (normalizedExercisesJson !== exercisesJson) {
      console.warn("Exercises response normalized before validation", {
        analysisId: analysis.id,
        weakPointId: weakPoint.id
      });
    }

    const exercises = exercisesSchema.safeParse(normalizedExercisesJson);
    if (!exercises.success) {
      console.error("Exercises validation failed", exercises.error.flatten());
      return NextResponse.json({ error: "Exercises did not match the expected format" }, { status: 502 });
    }

    const exerciseSet = await createExerciseSet({
      analysisId: analysis.id,
      userId: user.id,
      weakPointId: weakPoint.id,
      theory: theory.data,
      exercises: exercises.data
    });

    return NextResponse.json({ exerciseSet });
  } catch (error) {
    console.error("Exercise generation failed", error);
    return NextResponse.json({ error: "Could not generate exercises" }, { status: 500 });
  }
}

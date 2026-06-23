import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { completeExerciseSet } from "@/lib/db/fluent-queries";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";

const completeSchema = z.object({
  exerciseSetId: z.string().uuid(),
  score: z.number().int().min(0).max(20)
});

export async function POST(request: Request) {
  try {
    const originResponse = rejectForbiddenOrigin(request, "exercise_complete");
    if (originResponse) return originResponse;

    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const exerciseSet = await completeExerciseSet({
      exerciseSetId: parsed.data.exerciseSetId,
      userId: user.id,
      score: parsed.data.score
    });
    if (!exerciseSet) return NextResponse.json({ error: "Exercise set not found" }, { status: 404 });

    return NextResponse.json({ exerciseSet });
  } catch (error) {
    console.error("Exercise completion failed", error);
    return NextResponse.json({ error: "Could not complete exercise set" }, { status: 500 });
  }
}

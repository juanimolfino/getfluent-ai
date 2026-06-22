import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { textToSpeech } from "@/lib/conversation/elevenlabs";
import { getSessionState, hasPaidConversationCredit } from "@/lib/conversation/session-state";
import { getConversationAnalysisById } from "@/lib/db/fluent-queries";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import { enforceExpensiveEndpointRateLimit, enforceMonthlyUsageLimit } from "@/lib/http/rate-limit";

const ttsSchema = z.object({
  analysisId: z.string().uuid(),
  weakPointId: z.string().min(1).max(80),
  text: z.string().min(1).max(400)
});

export async function POST(request: Request) {
  try {
    const originResponse = rejectForbiddenOrigin(request, "exercises_tts");
    if (originResponse) return originResponse;

    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimitResponse = await enforceExpensiveEndpointRateLimit({ userId: user.id, kind: "tts" });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const parsed = ttsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const analysis = await getConversationAnalysisById(parsed.data.analysisId, user.id);
    if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    if (!analysis.weakPoints.some((point) => point.id === parsed.data.weakPointId)) {
      return NextResponse.json({ error: "Weak point not found" }, { status: 404 });
    }

    const session = await getSessionState(analysis.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!hasPaidConversationCredit(session)) {
      return NextResponse.json({ error: "No paid conversation credit found for this session" }, { status: 402 });
    }

    const monthlyUsageResponse = await enforceMonthlyUsageLimit({ userId: user.id, kind: "tts" });
    if (monthlyUsageResponse) return monthlyUsageResponse;

    const audio = await textToSpeech(parsed.data.text);
    return new Response(new Uint8Array(audio.audioBuffer), {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Exercise TTS failed", error);
    return NextResponse.json({ error: "Could not generate audio" }, { status: 500 });
  }
}

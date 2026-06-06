import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { getSessionState } from "@/lib/conversation/session-state";
import { conversationAnalysisPayloadSchema } from "@/lib/exercises/analysis";
import { buildAnalysisPrompt } from "@/lib/exercises/analysis-prompt";
import { parseJsonObject } from "@/lib/exercises/json";
import {
  createConversationAnalysis,
  getConversationAnalysisBySession,
  getUserLanguageProfile,
  markConversationSessionAnalyzed
} from "@/lib/db/fluent-queries";

const analyzeSchema = z.object({
  sessionId: z.string().uuid()
});

function buildTranscriptFromTurns(turns: { role: "assistant" | "user"; content: string }[]) {
  return turns.map((turn) => `${turn.role === "assistant" ? "Alex" : "User"}: ${turn.content}`).join("\n");
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const cached = await getConversationAnalysisBySession(parsed.data.sessionId, user.id);
    if (cached) return NextResponse.json({ analysis: cached });

    const session = await getSessionState(parsed.data.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "completed" && session.status !== "analyzed") {
      return NextResponse.json({ error: "Conversation must be completed before analysis" }, { status: 400 });
    }

    const languageProfile = await getUserLanguageProfile(user.id);
    const transcript = session.transcript || buildTranscriptFromTurns(session.turns);
    if (!transcript.trim()) return NextResponse.json({ error: "Conversation transcript is empty" }, { status: 400 });

    const prompt = buildAnalysisPrompt({
      transcript,
      englishLevel: languageProfile?.englishLevel ?? session.englishLevel,
      topic: session.topic,
      interests: languageProfile?.interests ?? []
    });

    const message = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 1200,
      system: "Return only valid JSON. Do not include markdown or commentary.",
      messages: [{ role: "user", content: prompt }]
    });

    let json: unknown;
    try {
      json = parseJsonObject(extractTextFromMessage(message));
    } catch (error) {
      console.error("Conversation analysis JSON parse failed", error);
      return NextResponse.json({ error: "Could not parse conversation analysis" }, { status: 502 });
    }

    const analysisPayload = conversationAnalysisPayloadSchema.safeParse(json);
    if (!analysisPayload.success) {
      console.error("Conversation analysis validation failed", analysisPayload.error.flatten());
      return NextResponse.json({ error: "Conversation analysis did not match the expected format" }, { status: 502 });
    }

    const analysis = await createConversationAnalysis({
      sessionId: session.id,
      userId: user.id,
      analysis: analysisPayload.data
    });
    if (session.status !== "analyzed") await markConversationSessionAnalyzed(session.id);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Conversation analysis failed", error);
    return NextResponse.json({ error: "Could not analyze conversation" }, { status: 500 });
  }
}

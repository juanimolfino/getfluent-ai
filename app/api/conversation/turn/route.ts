import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MAX_TOKENS, CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { buildConversationSystemPrompt } from "@/lib/conversation/conversation-prompt";
import { getSessionState, markSessionComplete, saveAssistantTurn, saveUserTurn } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import type { ConversationTurn } from "@/lib/db/schema";

const conversationTurnSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().min(1).max(2000)
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = conversationTurnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const session = await getSessionState(parsed.data.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    const userTurn: ConversationTurn = {
      role: "user",
      content: parsed.data.userText,
      timestamp: new Date().toISOString()
    };
    const updatedSession = await saveUserTurn(session.id, userTurn);
    const isLastTurn = updatedSession.completedTurns >= updatedSession.targetTurns;
    const languageProfile = await getUserLanguageProfile(user.id);

    const system = buildConversationSystemPrompt({
      englishLevel: updatedSession.englishLevel,
      topic: updatedSession.topic,
      nativeLanguage: languageProfile?.nativeLanguage ?? "spanish",
      targetTurns: updatedSession.targetTurns,
      completedTurns: updatedSession.completedTurns
    });

    const messages = updatedSession.turns.slice(-20).map((turn) => ({
      role: turn.role,
      content: turn.content
    }));

    const message = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: CONVERSATION_MAX_TOKENS,
      system,
      messages
    });

    const content = extractTextFromMessage(message);
    const assistantTurn: ConversationTurn = {
      role: "assistant",
      content,
      timestamp: new Date().toISOString()
    };
    const sessionWithAssistant = await saveAssistantTurn(session.id, assistantTurn);
    const completedSession = isLastTurn ? await markSessionComplete(session.id) : sessionWithAssistant;

    return NextResponse.json({
      turn: assistantTurn,
      session: {
        completedTurns: completedSession.completedTurns,
        targetTurns: completedSession.targetTurns,
        isComplete: completedSession.status === "completed"
      }
    });
  } catch (error) {
    console.error("Conversation turn failed", error);
    return NextResponse.json({ error: "Could not continue conversation" }, { status: 500 });
  }
}

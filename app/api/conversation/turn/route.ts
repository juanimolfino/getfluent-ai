import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { buildConversationSystemPrompt } from "@/lib/conversation/conversation-prompt";
import { textToSpeech } from "@/lib/conversation/elevenlabs";
import {
  appendTurnToSession,
  completeConversationSession,
  getConversationSession,
  getUserLanguageProfile
} from "@/lib/db/fluent-queries";
import type { ConversationTurn } from "@/lib/db/schema";

const conversationTurnSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().min(1).max(2000)
});

async function getAudioBase64(text: string) {
  try {
    const audio = await textToSpeech(text);
    return audio.audioBuffer.toString("base64");
  } catch (error) {
    console.warn("Conversation turn TTS skipped", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = conversationTurnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const session = await getConversationSession(parsed.data.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    const userTurn: ConversationTurn = {
      role: "user",
      content: parsed.data.userText,
      timestamp: new Date().toISOString()
    };
    const updatedSession = await appendTurnToSession(session.id, userTurn);
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
      max_tokens: 250,
      system,
      messages
    });

    const content = extractTextFromMessage(message);
    const assistantTurn: ConversationTurn = {
      role: "assistant",
      content,
      timestamp: new Date().toISOString()
    };
    const sessionWithAssistant = await appendTurnToSession(session.id, assistantTurn);
    const completedSession = isLastTurn ? await completeConversationSession(session.id) : sessionWithAssistant;
    const audioBase64 = await getAudioBase64(content);

    return NextResponse.json({
      turn: { ...assistantTurn, audioBase64 },
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

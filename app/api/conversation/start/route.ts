import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { buildConversationSystemPrompt } from "@/lib/conversation/conversation-prompt";
import { textToSpeech } from "@/lib/conversation/elevenlabs";
import { appendTurnToSession, createConversationSession, getUserLanguageProfile } from "@/lib/db/fluent-queries";
import type { ConversationTurn, EnglishLevel } from "@/lib/db/schema";

const startConversationSchema = z.object({
  topic: z.string().min(1).max(100),
  englishLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  targetTurns: z.number().int().min(4).max(30).default(10)
});

async function getAudioBase64(text: string) {
  try {
    const audio = await textToSpeech(text);
    return audio.audioBuffer.toString("base64");
  } catch (error) {
    console.warn("Conversation start TTS skipped", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = startConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const languageProfile = await getUserLanguageProfile(user.id);
    const englishLevel = (parsed.data.englishLevel ?? languageProfile?.englishLevel ?? "A1") as EnglishLevel;
    const nativeLanguage = languageProfile?.nativeLanguage ?? "spanish";

    const session = await createConversationSession({
      userId: user.id,
      englishLevel,
      topic: parsed.data.topic,
      targetTurns: parsed.data.targetTurns
    });

    const system = buildConversationSystemPrompt({
      englishLevel,
      topic: parsed.data.topic,
      nativeLanguage,
      targetTurns: parsed.data.targetTurns,
      completedTurns: 0
    });

    const message = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: "[START CONVERSATION]" }]
    });

    const content = extractTextFromMessage(message);
    const turn: ConversationTurn = {
      role: "assistant",
      content,
      timestamp: new Date().toISOString()
    };
    await appendTurnToSession(session.id, turn);

    const audioBase64 = await getAudioBase64(content);

    return NextResponse.json({
      sessionId: session.id,
      turn: { ...turn, audioBase64 },
      session: {
        id: session.id,
        topic: session.topic,
        englishLevel: session.englishLevel,
        targetTurns: session.targetTurns,
        completedTurns: 0
      }
    });
  } catch (error) {
    console.error("Conversation start failed", error);
    return NextResponse.json({ error: "Could not start conversation" }, { status: 500 });
  }
}

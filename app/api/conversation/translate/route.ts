import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, getAnthropic, extractTextFromMessage } from "@/lib/conversation/anthropic";
import { getSessionState, hasPaidConversationCredit } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import { enforceExpensiveEndpointRateLimit, enforceMonthlyUsageLimit } from "@/lib/http/rate-limit";
import type { NativeLanguage } from "@/lib/db/schema";

const translateSchema = z.object({
  sessionId: z.string().uuid(),
  text: z.string().min(1).max(2000)
});

const LANGUAGE_LABELS: Record<NativeLanguage, string> = {
  spanish: "Spanish",
  portuguese: "Portuguese",
  french: "French",
  italian: "Italian",
  german: "German",
  other: "the learner's native language"
};

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(payload, { ...init, headers });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUserProfile();
    if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

    const rateLimitResponse = await enforceExpensiveEndpointRateLimit({ userId: user.id, kind: "translation" });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const parsed = translateSchema.safeParse(body);
    if (!parsed.success) return jsonNoStore({ error: parsed.error.flatten() }, { status: 400 });

    const session = await getSessionState(parsed.data.sessionId, user.id);
    if (!session) return jsonNoStore({ error: "Session not found" }, { status: 404 });
    if (!hasPaidConversationCredit(session)) {
      return jsonNoStore({ error: "No paid conversation credit found for this session" }, { status: 402 });
    }

    const assistantTurnExists = session.turns.some((turn) => turn.role === "assistant" && turn.content === parsed.data.text);
    if (!assistantTurnExists) return jsonNoStore({ error: "Only Alex messages can be translated" }, { status: 400 });

    const monthlyUsageResponse = await enforceMonthlyUsageLimit({ userId: user.id, kind: "translation" });
    if (monthlyUsageResponse) return monthlyUsageResponse;

    const languageProfile = await getUserLanguageProfile(user.id);
    const targetLanguage = LANGUAGE_LABELS[languageProfile?.nativeLanguage ?? "spanish"];
    const message = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 400,
      system: [
        "Translate Alex's English message for a language learner.",
        `Target language: ${targetLanguage}.`,
        "Return only the translation. Do not add explanations, labels, quotes, or alternatives.",
        "Keep the meaning, tone, and names. Do not answer the message."
      ].join("\n"),
      messages: [{ role: "user", content: parsed.data.text }]
    });
    const translation = extractTextFromMessage(message);

    return jsonNoStore({ translation, targetLanguage });
  } catch (error) {
    console.error("Conversation translation failed", error);
    return jsonNoStore({ error: "Could not translate message" }, { status: 500 });
  }
}

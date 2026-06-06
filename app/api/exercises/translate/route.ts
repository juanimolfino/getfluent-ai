import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MODEL, extractTextFromMessage, getAnthropic } from "@/lib/conversation/anthropic";
import { getConversationAnalysisById, getUserLanguageProfile } from "@/lib/db/fluent-queries";
import type { NativeLanguage } from "@/lib/db/schema";

const translateExerciseSchema = z.object({
  analysisId: z.string().uuid(),
  weakPointId: z.string().min(1).max(80),
  summary: z.string().min(1).max(1200),
  examples: z.array(z.string().min(1).max(300)).min(0).max(4)
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

    const body = await request.json();
    const parsed = translateExerciseSchema.safeParse(body);
    if (!parsed.success) return jsonNoStore({ error: parsed.error.flatten() }, { status: 400 });

    const analysis = await getConversationAnalysisById(parsed.data.analysisId, user.id);
    if (!analysis) return jsonNoStore({ error: "Analysis not found" }, { status: 404 });
    if (!analysis.weakPoints.some((point) => point.id === parsed.data.weakPointId)) {
      return jsonNoStore({ error: "Weak point not found" }, { status: 404 });
    }

    const profile = await getUserLanguageProfile(user.id);
    const targetLanguage = LANGUAGE_LABELS[profile?.nativeLanguage ?? "spanish"];
    const message = await getAnthropic().messages.create({
      model: CONVERSATION_MODEL,
      max_tokens: 700,
      system: [
        "Translate this English mini lesson for an English learner.",
        `Target language: ${targetLanguage}.`,
        "Return only the translation. Keep English example sentences unchanged if translating them would harm the lesson.",
        "Do not add extra explanation, labels, markdown, or alternatives."
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [parsed.data.summary, ...parsed.data.examples].join("\n\n")
        }
      ]
    });

    return jsonNoStore({ translation: extractTextFromMessage(message), targetLanguage });
  } catch (error) {
    console.error("Exercise translation failed", error);
    return jsonNoStore({ error: "Could not translate exercise theory" }, { status: 500 });
  }
}

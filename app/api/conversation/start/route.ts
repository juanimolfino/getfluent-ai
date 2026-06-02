import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { createSessionState } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import type { EnglishLevel } from "@/lib/db/schema";

const startConversationSchema = z.object({
  topic: z.string().min(1).max(100),
  englishLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  targetTurns: z.number().int().min(4).max(30).default(10)
});

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

    const session = await createSessionState({
      userId: user.id,
      englishLevel,
      topic: parsed.data.topic,
      targetTurns: parsed.data.targetTurns
    });

    return NextResponse.json({
      sessionId: session.id,
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

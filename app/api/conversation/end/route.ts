import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { createElevenLabsStream, type ElevenLabsCharAlignment, type ElevenLabsStream } from "@/lib/conversation/elevenlabs-stream";
import { getSessionState, hasPaidConversationCredit, markSessionComplete, saveAssistantTurn } from "@/lib/conversation/session-state";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import type { ConversationTurn } from "@/lib/db/schema";

const endConversationSchema = z.object({
  sessionId: z.string().uuid(),
  includePremiumAudio: z.boolean().optional()
});

const GOODBYE_TEXT =
  "Thanks for the conversation. It was really nice talking with you. You can now open your analysis to see what went well and what to practice next.";

type PremiumTimingChar = {
  char: string;
  startMs: number;
  durationMs: number;
};

type PremiumGoodbyeAudio = {
  chunks: { chunk: string; seq: number }[];
  timings: PremiumTimingChar[];
};

function transformElevenLabsAlignment(alignment: ElevenLabsCharAlignment): PremiumTimingChar[] {
  return alignment.chars.map((char, index) => ({
    char,
    startMs: Math.round(alignment.charStartTimesMs[index] ?? 0),
    durationMs: Math.round(alignment.charDurationsMs[index] ?? 0)
  }));
}

async function synthesizePremiumGoodbyeAudio(text: string): Promise<PremiumGoodbyeAudio | null> {
  const chunks: { chunk: string; seq: number }[] = [];
  const timings: PremiumTimingChar[] = [];
  let seq = 0;
  let elevenlabs: ElevenLabsStream | null = null;
  let resolveClose: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });

  try {
    elevenlabs = await createElevenLabsStream({
      onAudioChunk(chunk) {
        chunks.push({ chunk: chunk.toString("base64"), seq });
        seq += 1;
      },
      onCharTimings(alignment) {
        timings.push(...transformElevenLabsAlignment(alignment));
      },
      onError(error) {
        console.error("Premium goodbye audio failed", error);
        resolveClose();
      },
      onClose() {
        resolveClose();
      }
    });

    elevenlabs.sendText(text);
    elevenlabs.finish();
    await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 10000))]);
  } catch (error) {
    console.error("Premium goodbye audio setup failed", error);
    return null;
  } finally {
    try {
      elevenlabs?.close();
    } catch {
      // Ignore close errors; the conversation is already complete.
    }
  }

  if (!chunks.length) return null;
  return { chunks, timings };
}

export async function POST(request: Request) {
  try {
    const originResponse = rejectForbiddenOrigin(request, "conversation_end");
    if (originResponse) return originResponse;

    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = endConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const session = await getSessionState(parsed.data.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!hasPaidConversationCredit(session)) {
      return NextResponse.json({ error: "No paid conversation credit found for this session" }, { status: 402 });
    }
    const shouldIncludePremiumAudio = Boolean(parsed.data.includePremiumAudio);

    if (session.status !== "active") {
      return NextResponse.json({
        session: {
          completedTurns: session.completedTurns,
          targetTurns: session.targetTurns,
          isComplete: true
        }
      });
    }

    const turn: ConversationTurn = {
      role: "assistant",
      content: GOODBYE_TEXT,
      timestamp: new Date().toISOString()
    };
    await saveAssistantTurn(session.id, turn);
    const completedSession = await markSessionComplete(session.id);
    const premiumAudio = shouldIncludePremiumAudio ? await synthesizePremiumGoodbyeAudio(GOODBYE_TEXT) : null;

    return NextResponse.json({
      turn,
      premiumAudio,
      session: {
        completedTurns: completedSession.completedTurns,
        targetTurns: completedSession.targetTurns,
        isComplete: true
      }
    });
  } catch (error) {
    console.error("Conversation end failed", error);
    return NextResponse.json({ error: "Could not end conversation" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MAX_TOKENS, CONVERSATION_MODEL, getAnthropic } from "@/lib/conversation/anthropic";
import { getConversationFollowUpDelta } from "@/lib/conversation/assistant-response";
import { buildConversationSystemPrompt } from "@/lib/conversation/conversation-prompt";
import { getSessionState, markSessionComplete, saveAssistantTurn, saveUserTurn } from "@/lib/conversation/session-state";
import { getUserLanguageProfile } from "@/lib/db/fluent-queries";
import type { ConversationTurn } from "@/lib/db/schema";

const START_CONVERSATION_TEXT = "[START_CONVERSATION]";

const conversationStreamSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().min(1).max(2000)
});

type ConversationStreamDoneEvent = {
  type: "done";
  fullText: string;
  isComplete: boolean;
  completedTurns: number;
  targetTurns: number;
  metrics: {
    timeToFirstTokenMs: number | null;
    timeToStreamCompleteMs: number;
    chars: number;
  };
};

function encodeSse(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function toAnthropicMessages(turns: ConversationTurn[]) {
  return turns.slice(-20).map((turn) => ({
    role: turn.role,
    content: turn.content
  }));
}

export async function POST(request: Request) {
  const requestStartedAt = performance.now();

  try {
    const user = await getCurrentUserProfile();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = conversationStreamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const session = await getSessionState(parsed.data.sessionId, user.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    const isStartTurn = parsed.data.userText === START_CONVERSATION_TEXT && session.turns.length === 0;
    const userTurn: ConversationTurn | null = isStartTurn
      ? null
      : {
          role: "user",
          content: parsed.data.userText,
          timestamp: new Date().toISOString()
        };

    const updatedSession = userTurn ? await saveUserTurn(session.id, userTurn) : session;
    const isLastTurn = updatedSession.completedTurns >= updatedSession.targetTurns;
    const languageProfile = await getUserLanguageProfile(user.id);

    const system = buildConversationSystemPrompt({
      englishLevel: updatedSession.englishLevel,
      topic: updatedSession.topic,
      nativeLanguage: languageProfile?.nativeLanguage ?? "spanish",
      targetTurns: updatedSession.targetTurns,
      completedTurns: updatedSession.completedTurns
    });

    const messages = isStartTurn
      ? [{ role: "user" as const, content: "[START CONVERSATION]" }]
      : toAnthropicMessages(updatedSession.turns);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "";
        let timeToFirstTokenMs: number | null = null;

        try {
          const anthropicStream = getAnthropic().messages.stream({
            model: CONVERSATION_MODEL,
            max_tokens: CONVERSATION_MAX_TOKENS,
            system,
            messages
          });

          for await (const event of anthropicStream) {
            if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
            timeToFirstTokenMs ??= Math.round(performance.now() - requestStartedAt);
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(encodeSse({ type: "text", delta: event.delta.text })));
          }

          const followUpDelta = getConversationFollowUpDelta(fullText, isLastTurn);
          if (followUpDelta) {
            fullText += followUpDelta;
            controller.enqueue(encoder.encode(encodeSse({ type: "text", delta: followUpDelta })));
          }

          const timeToStreamCompleteMs = Math.round(performance.now() - requestStartedAt);
          const chars = fullText.length;
          const doneEvent: ConversationStreamDoneEvent = {
            type: "done",
            fullText,
            isComplete: isLastTurn,
            completedTurns: updatedSession.completedTurns,
            targetTurns: updatedSession.targetTurns,
            metrics: {
              timeToFirstTokenMs,
              timeToStreamCompleteMs,
              chars
            }
          };
          controller.enqueue(encoder.encode(encodeSse(doneEvent)));
          console.log(
            `[latency] turn sessionId=${updatedSession.id} ttft=${timeToFirstTokenMs ?? "null"}ms complete=${timeToStreamCompleteMs}ms chars=${chars}`
          );

          const assistantTurn: ConversationTurn = {
            role: "assistant",
            content: fullText,
            timestamp: new Date().toISOString()
          };

          // Persist Alex after the done event so the visible stream is not delayed by DB writes.
          try {
            if (isLastTurn) {
              await saveAssistantTurn(updatedSession.id, assistantTurn);
              await markSessionComplete(updatedSession.id);
            } else {
              await saveAssistantTurn(updatedSession.id, assistantTurn);
            }
          } catch (saveError) {
            console.error("Conversation stream post-response save failed", saveError);
          }
        } catch (error) {
          console.error("Conversation stream failed", error);
          controller.enqueue(encoder.encode(encodeSse({ type: "error", message: "Could not continue conversation" })));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    console.error("Conversation stream setup failed", error);
    return NextResponse.json({ error: "Could not start conversation stream" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CONVERSATION_MAX_TOKENS, CONVERSATION_MODEL, getAnthropic } from "@/lib/conversation/anthropic";
import { getConversationFollowUpDelta } from "@/lib/conversation/assistant-response";
import { buildConversationSystemPrompt } from "@/lib/conversation/conversation-prompt";
import { takeElevenLabsSafeChunk } from "@/lib/conversation/elevenlabs-text-buffer";
import { createElevenLabsStream, type ElevenLabsCharAlignment, type ElevenLabsStream } from "@/lib/conversation/elevenlabs-stream";
import { getCachedAudio, getPhraseCacheVoiceId, isCachedPhrase } from "@/lib/conversation/phrase-cache";
import {
  getSessionStateById,
  hasPaidConversationCredit,
  incrementCharactersUsed,
  markSessionComplete,
  saveAssistantTurn,
  saveUserTurn
} from "@/lib/conversation/session-state";
import { getUserLanguageProfile, getUserMonthlyCharacterUsage } from "@/lib/db/fluent-queries";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";
import { enforceExpensiveEndpointRateLimit, enforceMonthlyUsageLimit } from "@/lib/http/rate-limit";
import type { ConversationSession, ConversationTurn } from "@/lib/db/schema";

const START_CONVERSATION_TEXT = "[START_CONVERSATION]";
const DEFAULT_PREMIUM_MONTHLY_CHARACTER_LIMIT = 100000;

const conversationStreamSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().min(1).max(2000)
});

type PremiumDoneEvent = {
  type: "done";
  fullText: string;
  isComplete: boolean;
  completedTurns: number;
  targetTurns: number;
  metrics: {
    timeToFirstTokenMs: number | null;
    timeToFirstAudioMs: number | null;
    requestToBackendReadyMs: number | null;
    timeToStreamCompleteMs: number;
    chars: number;
  };
};

type PremiumTimingChar = {
  char: string;
  startMs: number;
  durationMs: number;
};

type PremiumStreamEvent =
  | { type: "text"; delta: string }
  | { type: "audio"; chunk: string; seq: number }
  | { type: "timing"; chars: PremiumTimingChar[]; startMs: number }
  | { type: "audio_failed" }
  | { type: "server_metrics"; requestToBackendReadyMs: number }
  | PremiumDoneEvent
  | { type: "error"; message: string };

type PremiumLatencyLogInput = {
  sessionId: string;
  timeToFirstTokenMs: number | null;
  timeToFirstAudioMs: number | null;
  timeToStreamCompleteMs: number;
  chars: number;
};

type PerfLogValue = string | number | boolean | null | undefined;

function encodeSse(payload: PremiumStreamEvent) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function toAnthropicMessages(turns: ConversationTurn[]) {
  return turns.slice(-20).map((turn) => ({
    role: turn.role,
    content: turn.content
  }));
}

function applyUserTurnInMemory(session: ConversationSession, userTurn: ConversationTurn | null): ConversationSession {
  if (!userTurn) return session;
  const turns = [...session.turns, userTurn];

  return {
    ...session,
    turns,
    completedTurns: turns.filter((turn) => turn.role === "user").length,
    updatedAt: new Date()
  };
}

function logPremiumLatency(metrics: PremiumLatencyLogInput) {
  console.log(
    `[latency] premium-turn sessionId=${metrics.sessionId} ttft=${metrics.timeToFirstTokenMs ?? "null"}ms ttfAudio=${metrics.timeToFirstAudioMs ?? "null"}ms complete=${metrics.timeToStreamCompleteMs}ms chars=${metrics.chars}`
  );
}

function logPerfStep(step: string, startedAt: number, requestStartedAt: number, fields: Record<string, PerfLogValue> = {}) {
  const ms = Math.round(performance.now() - startedAt);
  const requestMs = Math.round(performance.now() - requestStartedAt);
  const details = Object.entries({ requestMs, ...fields })
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  console.log(`[perf] step=${step} ms=${ms}${details ? ` ${details}` : ""}`);
}

function getPremiumMonthlyCharacterLimit() {
  const value = Number(process.env.PREMIUM_TTS_MONTHLY_CHARACTER_LIMIT ?? DEFAULT_PREMIUM_MONTHLY_CHARACTER_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_PREMIUM_MONTHLY_CHARACTER_LIMIT;
}

function transformElevenLabsAlignment(alignment: ElevenLabsCharAlignment): PremiumTimingChar[] {
  return alignment.chars.map((char, index) => ({
    char,
    startMs: Math.round(alignment.charStartTimesMs[index] ?? 0),
    durationMs: Math.round(alignment.charDurationsMs[index] ?? 0)
  }));
}

async function waitForElevenLabsClose() {
  let resolveClose: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  return {
    closed,
    resolveClose: () => resolveClose()
  };
}

export async function POST(request: Request) {
  const requestStartedAt = performance.now();

  try {
    const originResponse = rejectForbiddenOrigin(request, "conversation_stream_premium");
    if (originResponse) return originResponse;

    const authStartedAt = performance.now();
    const user = await getCurrentUserProfile()
      .then((user) => {
        logPerfStep("auth_get_db_user", authStartedAt, requestStartedAt, { hasUser: Boolean(user) });
        return user;
      })
      .catch((error) => {
        logPerfStep("auth_get_db_user", authStartedAt, requestStartedAt, { failed: true });
        throw error;
      });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const bodyParseStartedAt = performance.now();
    const body = await request.json();
    const parsed = conversationStreamSchema.safeParse(body);
    logPerfStep("body_parse_validate", bodyParseStartedAt, requestStartedAt, { valid: parsed.success });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const rateLimitPromise = enforceExpensiveEndpointRateLimit({ userId: user.id, kind: "conversation" });
    const monthlyClaudeUsagePromise = enforceMonthlyUsageLimit({ userId: user.id, kind: "conversation" });

    const sessionLoadStartedAt = performance.now();
    let sessionLoadError: unknown = null;
    const sessionPromise = getSessionStateById(parsed.data.sessionId)
      .then((session) => {
        logPerfStep("session_load", sessionLoadStartedAt, requestStartedAt, {
          sessionId: parsed.data.sessionId,
          sessionTurns: session?.turns.length ?? null
        });
        return session;
      })
      .catch((error) => {
        sessionLoadError = error;
        logPerfStep("session_load", sessionLoadStartedAt, requestStartedAt, {
          sessionId: parsed.data.sessionId,
          failed: true
        });
        return null;
      });

    const languageProfileStartedAt = performance.now();
    const languageProfilePromise = getUserLanguageProfile(user.id)
      .then((languageProfile) => {
        logPerfStep("language_profile_load", languageProfileStartedAt, requestStartedAt, { userId: user.id });
        return languageProfile;
      })
      .catch((error) => {
        logPerfStep("language_profile_load", languageProfileStartedAt, requestStartedAt, {
          userId: user.id,
          failed: true
        });
        throw error;
      });

    const monthlyUsageStartedAt = performance.now();
    const monthlyCharacterUsagePromise = getUserMonthlyCharacterUsage(user.id)
      .then((usage) => {
        logPerfStep("monthly_character_usage_load", monthlyUsageStartedAt, requestStartedAt, { userId: user.id });
        return usage;
      })
      .catch((error) => {
        logPerfStep("monthly_character_usage_load", monthlyUsageStartedAt, requestStartedAt, {
          userId: user.id,
          failed: true
        });
        throw error;
      });

    const [rateLimitResponse, monthlyClaudeUsageResponse, session, languageProfile, monthlyCharacterUsage] = await Promise.all([
      rateLimitPromise,
      monthlyClaudeUsagePromise,
      sessionPromise,
      languageProfilePromise,
      monthlyCharacterUsagePromise
    ]);
    if (rateLimitResponse) return rateLimitResponse;
    if (monthlyClaudeUsageResponse) return monthlyClaudeUsageResponse;
    if (sessionLoadError) throw sessionLoadError;
    const monthlyCharacterLimit = getPremiumMonthlyCharacterLimit();
    if (monthlyCharacterUsage >= monthlyCharacterLimit) {
      console.warn(
        `[usage-limit] premium monthly character limit reached userId=${user.id} used=${monthlyCharacterUsage} limit=${monthlyCharacterLimit}`
      );
      return NextResponse.json({ error: "Monthly usage limit reached" }, { status: 429 });
    }
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.userId !== user.id) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (!hasPaidConversationCredit(session)) {
      return NextResponse.json({ error: "No paid conversation credit found for this session" }, { status: 402 });
    }
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

    const updatedSession = applyUserTurnInMemory(session, userTurn);
    const saveUserTurnStartedAt = performance.now();
    const saveUserTurnPromise: Promise<ConversationSession | null> = userTurn
      ? saveUserTurn(session.id, userTurn)
          .then((savedSession) => {
            logPerfStep("save_user_turn_async_complete", saveUserTurnStartedAt, requestStartedAt, {
              sessionId: session.id,
              completedTurns: savedSession.completedTurns,
              sessionTurns: savedSession.turns.length
            });
            return savedSession;
          })
          .catch((error) => {
            console.error("Premium stream user turn save failed", error);
            return null;
          })
      : Promise.resolve(updatedSession);
    logPerfStep("save_user_turn", saveUserTurnStartedAt, requestStartedAt, {
      sessionId: session.id,
      skipped: !userTurn,
      queued: Boolean(userTurn),
      completedTurns: updatedSession.completedTurns,
      sessionTurns: updatedSession.turns.length
    });
    const isLastTurn = updatedSession.completedTurns >= updatedSession.targetTurns;

    const promptBuildStartedAt = performance.now();
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
    const messageChars = messages.reduce((total, message) => total + message.content.length, 0);
    const requestToBackendReadyMs = Math.round(performance.now() - requestStartedAt);
    logPerfStep("build_prompt_messages", promptBuildStartedAt, requestStartedAt, {
      sessionId: updatedSession.id,
      systemChars: system.length,
      sessionTurns: updatedSession.turns.length,
      messageCount: messages.length,
      messageChars,
      historyWindow: 20
    });

    const phraseCacheVoiceId = getPhraseCacheVoiceId();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "";
        let ttsBuffer = "";
        let audioSeq = 0;
        let audioFailed = false;
        let timeToFirstTokenMs: number | null = null;
        let timeToFirstAudioMs: number | null = null;
        let timeToStreamCompleteMs: number | null = null;
        let elevenlabs: ElevenLabsStream | null = null;
        let sentTextToElevenLabs = false;
        let charactersSentToElevenLabs = 0;
        let streamFinished = false;
        const elevenlabsClose = await waitForElevenLabsClose();

        function emit(event: PremiumStreamEvent) {
          controller.enqueue(encoder.encode(encodeSse(event)));
        }

        function emitText(delta: string) {
          emit({ type: "text", delta });
        }

        function emitAudio(chunk: Buffer) {
          emit({ type: "audio", chunk: chunk.toString("base64"), seq: audioSeq });
          audioSeq += 1;
        }

        function emitTiming(alignment: ElevenLabsCharAlignment) {
          const chars = transformElevenLabsAlignment(alignment);
          if (!chars.length) return;
          emit({ type: "timing", chars, startMs: chars[0]?.startMs ?? 0 });
        }

        function emitAudioFailed() {
          emit({ type: "audio_failed" });
        }

        function emitError(message: string) {
          emit({ type: "error", message });
        }

        function failPremiumAudio(reason: string, error?: unknown) {
          if (error) console.error(reason, error);
          if (!audioFailed && !streamFinished) emitAudioFailed();
          audioFailed = true;
          try {
            elevenlabs?.close();
          } catch {
            // Ignore close errors; the text stream must continue and fall back client-side.
          }
          elevenlabsClose.resolveClose();
        }

        let elevenlabsOpenPromise: Promise<ElevenLabsStream | null>;

        async function serveCachedPhraseAudio(text: string) {
          try {
            const cachedAudio = await getCachedAudio(text, phraseCacheVoiceId);
            if (!cachedAudio) {
              console.log(`[phrase-cache] miss voiceId=${phraseCacheVoiceId} chars=${text.length}`);
              await sendTextToElevenLabs(text);
              return;
            }

            timeToFirstAudioMs ??= Math.round(performance.now() - requestStartedAt);
            emitAudio(cachedAudio);
            console.log(`[phrase-cache] hit voiceId=${phraseCacheVoiceId} chars=${text.length}`);
          } catch (error) {
            console.error("Phrase cache lookup failed", error);
            await sendTextToElevenLabs(text);
          }
        }

        async function sendTextToElevenLabs(text: string) {
          if (audioFailed) return;
          if (!text.trim()) return;

          const stream = elevenlabs ?? await elevenlabsOpenPromise;
          if (!stream || audioFailed) return;

          try {
            stream.sendText(text);
            charactersSentToElevenLabs += text.endsWith(" ") ? text.length : text.length + 1;
            sentTextToElevenLabs = true;
          } catch (error) {
            failPremiumAudio("Premium ElevenLabs sendText failed", error);
          }
        }

        async function flushTextToElevenLabs(force = false) {
          if (audioFailed) return;
          const nextChunk = takeElevenLabsSafeChunk(ttsBuffer, force);
          if (!nextChunk) return;
          const text = nextChunk.chunk;
          ttsBuffer = nextChunk.rest;
          if (!text.trim()) return;

          if (isCachedPhrase(text)) {
            return serveCachedPhraseAudio(text);
          }

          await sendTextToElevenLabs(text);
        }

        try {
          emit({ type: "server_metrics", requestToBackendReadyMs });
          const elevenlabsOpenStartedAt = performance.now();
          elevenlabsOpenPromise = Promise.resolve()
            .then(() => createElevenLabsStream({
              onAudioChunk(chunk) {
                timeToFirstAudioMs ??= Math.round(performance.now() - requestStartedAt);
                emitAudio(chunk);
              },
              onCharTimings(timings) {
                emitTiming(timings);
              },
              onError(error) {
                failPremiumAudio("Premium ElevenLabs stream failed", error);
              },
              onClose() {
                elevenlabsClose.resolveClose();
              }
            }))
            .then((stream) => {
              elevenlabs = stream;
              if (streamFinished || audioFailed) stream.close();
              logPerfStep("elevenlabs_ws_open", elevenlabsOpenStartedAt, requestStartedAt, { sessionId: updatedSession.id });
              return stream;
            })
            .catch((error) => {
              logPerfStep("elevenlabs_ws_open", elevenlabsOpenStartedAt, requestStartedAt, {
                sessionId: updatedSession.id,
                failed: true
              });
              failPremiumAudio("Premium ElevenLabs stream setup failed", error);
              return null;
            });

          const anthropicStreamStartedAt = performance.now();
          const anthropicStream = getAnthropic().messages.stream({
            model: CONVERSATION_MODEL,
            max_tokens: CONVERSATION_MAX_TOKENS,
            system,
            messages
          });
          logPerfStep("anthropic_stream_call", anthropicStreamStartedAt, requestStartedAt, {
            sessionId: updatedSession.id,
            model: CONVERSATION_MODEL,
            maxTokens: CONVERSATION_MAX_TOKENS
          });
          const firstClaudeDeltaStartedAt = performance.now();

          for await (const event of anthropicStream) {
            if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
            if (timeToFirstTokenMs === null) {
              timeToFirstTokenMs = Math.round(performance.now() - requestStartedAt);
              logPerfStep("claude_first_text_delta", firstClaudeDeltaStartedAt, requestStartedAt, {
                sessionId: updatedSession.id,
                ttft: timeToFirstTokenMs
              });
            }
            fullText += event.delta.text;
            ttsBuffer += event.delta.text;
            emitText(event.delta.text);
            const cachedAudioPromise = flushTextToElevenLabs();
            if (cachedAudioPromise) await cachedAudioPromise;
          }
          timeToStreamCompleteMs = Math.round(performance.now() - requestStartedAt);

          const followUpDelta = getConversationFollowUpDelta(fullText, isLastTurn);
          if (followUpDelta) {
            fullText += followUpDelta;
            ttsBuffer += followUpDelta;
            emitText(followUpDelta);
          }

          const cachedAudioPromise = flushTextToElevenLabs(true);
          if (cachedAudioPromise) await cachedAudioPromise;

          const activeElevenLabs = elevenlabs as ElevenLabsStream | null;
          if (activeElevenLabs && !audioFailed) {
            try {
              if (sentTextToElevenLabs) {
                activeElevenLabs.finish();
                await Promise.race([
                  elevenlabsClose.closed,
                  new Promise<void>((resolve) => setTimeout(resolve, 15000))
                ]);
              } else {
                activeElevenLabs.close();
                elevenlabsClose.resolveClose();
              }
            } catch (error) {
              failPremiumAudio("Premium ElevenLabs finish failed", error);
            }
          }

          const chars = fullText.length;
          const doneEvent: PremiumDoneEvent = {
            type: "done",
            fullText,
            isComplete: isLastTurn,
            completedTurns: updatedSession.completedTurns,
            targetTurns: updatedSession.targetTurns,
            metrics: {
              timeToFirstTokenMs,
              timeToFirstAudioMs,
              requestToBackendReadyMs,
              timeToStreamCompleteMs,
              chars
            }
          };
          emit(doneEvent);
          logPremiumLatency({
            sessionId: updatedSession.id,
            timeToFirstTokenMs,
            timeToFirstAudioMs,
            timeToStreamCompleteMs,
            chars
          });

          const assistantTurn: ConversationTurn = {
            role: "assistant",
            content: fullText,
            timestamp: new Date().toISOString()
          };

          void (async () => {
            try {
              const savedUserSession = await saveUserTurnPromise;
              if (userTurn && !savedUserSession) {
                console.error("Premium stream assistant turn save skipped because user turn save failed");
              } else {
                await saveAssistantTurn(updatedSession.id, assistantTurn);
                if (isLastTurn) await markSessionComplete(updatedSession.id);
              }
            } catch (saveError) {
              console.error("Premium stream post-response save failed", saveError);
            }

            try {
              const totalSessionCharacters = await incrementCharactersUsed(updatedSession.id, charactersSentToElevenLabs);
              console.log(`[usage] turn sessionId=${updatedSession.id} chars=${charactersSentToElevenLabs} totalSession=${totalSessionCharacters}`);
            } catch (usageError) {
              console.error("Premium stream character usage update failed", usageError);
            }
          })();
        } catch (error) {
          console.error("Premium conversation stream failed", error);
          emitError("Could not continue premium conversation");
        } finally {
          streamFinished = true;
          (elevenlabs as ElevenLabsStream | null)?.close();
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
    console.error("Premium conversation stream setup failed", error);
    return NextResponse.json({ error: "Could not start premium conversation stream" }, { status: 500 });
  }
}

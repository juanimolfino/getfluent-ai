import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isPremiumUser } from "@/lib/billing/tier";
import { getSessionState, incrementSttAudioMsUsed } from "@/lib/conversation/session-state";
import {
  STT_METRIC_EVENTS,
  buildSttMetricLogLine,
  normalizeSttMetricText,
  shouldIncrementSttAudioUsage
} from "@/lib/conversation/stt-metrics";
import { isAllowedRequestOrigin } from "@/lib/http/origin";

const speechInputProviderSchema = z.enum(["browser_speech_recognition", "deepgram_flux"]);
const sttMetricEventSchema = z.enum(STT_METRIC_EVENTS);

const sttMetricSchema = z.object({
  sessionId: z.string().uuid(),
  event: sttMetricEventSchema,
  provider: speechInputProviderSchema,
  model: z.string().max(80).optional(),
  selectedByFlag: z.boolean().optional(),
  fallbackUsed: z.boolean().optional(),
  fallbackReason: z.string().max(240).optional(),
  audioMs: z.number().int().min(0).max(30 * 60 * 1000).optional(),
  transcriptChars: z.number().int().min(0).max(20000).optional(),
  endOfTurnConfidence: z.number().min(0).max(1).optional(),
  tokenFetchMs: z.number().int().min(0).max(60000).optional(),
  wsOpenMs: z.number().int().min(0).max(60000).optional(),
  firstUpdateLatencyMs: z.number().int().min(0).max(120000).optional(),
  endOfTurnLatencyMs: z.number().int().min(0).max(120000).optional(),
  postSpeechSilenceMs: z.number().int().min(0).max(120000).optional(),
  eotToSubmitMs: z.number().int().min(0).max(120000).optional(),
  deepgramTurnIndex: z.number().int().min(0).max(10000).optional(),
  mediaRecorderMimeType: z.enum(["audio/webm;codecs=opus", "audio/ogg;codecs=opus"]).optional(),
  errorCode: z.string().max(120).optional()
});

const sttMetricsPayloadSchema = z.union([sttMetricSchema, z.array(sttMetricSchema).min(1).max(20)]);
type SttMetricPayload = z.infer<typeof sttMetricSchema>;

function shouldLogSttMetric(metric: SttMetricPayload) {
  if (process.env.STT_DEBUG_LOGS === "true" || process.env.NEXT_PUBLIC_STT_DEBUG_LOGS === "true") return true;
  return metric.event === "deepgram_end_of_turn" || metric.event === "deepgram_ws_error" || metric.event === "stt_fallback_to_browser";
}

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(payload, { ...init, headers });
}

export async function POST(request: Request) {
  try {
    if (!isAllowedRequestOrigin(request)) {
      console.warn("[stt-metric] origin rejected");
      return jsonNoStore({ error: "Forbidden" }, { status: 403 });
    }

    const user = await getCurrentUserProfile();
    if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = sttMetricsPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonNoStore({ error: parsed.error.flatten() }, { status: 400 });
    }

    const metrics = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    const sessionIds = new Set(metrics.map((metric) => metric.sessionId));
    if (sessionIds.size !== 1) {
      return jsonNoStore({ error: "Metrics must belong to one session" }, { status: 400 });
    }

    const [sessionId] = [...sessionIds];
    const session = await getSessionState(sessionId, user.id);
    if (!session) return jsonNoStore({ error: "Session not found" }, { status: 404 });

    const premiumUser = await isPremiumUser(user.id);
    if (metrics.some((metric) => metric.provider === "deepgram_flux") && !premiumUser) {
      return jsonNoStore({ error: "Premium subscription required" }, { status: 403 });
    }

    let audioMsToIncrement = 0;

    metrics.forEach((item) => {
      const metric = {
        ...item,
        userId: user.id,
        sessionId: session.id,
        isPremium: premiumUser,
        fallbackReason: normalizeSttMetricText(item.fallbackReason, ""),
        errorCode: normalizeSttMetricText(item.errorCode, "")
      };

      if (shouldLogSttMetric(item)) console.log(buildSttMetricLogLine(metric));
      if (shouldIncrementSttAudioUsage(metric)) audioMsToIncrement += metric.audioMs ?? 0;
    });

    if (audioMsToIncrement > 0) {
      const totalSessionAudioMs = await incrementSttAudioMsUsed(session.id, audioMsToIncrement);
      console.log(`[stt-usage] sessionId=${session.id} audioMs=${audioMsToIncrement} totalSessionAudioMs=${totalSessionAudioMs}`);
    }

    return jsonNoStore({ ok: true }, { status: 202 });
  } catch {
    console.error("[stt-metric] route failed");
    return jsonNoStore({ ok: false }, { status: 202 });
  }
}

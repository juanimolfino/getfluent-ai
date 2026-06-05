import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isPremiumUser } from "@/lib/billing/tier";
import { getSessionState } from "@/lib/conversation/session-state";
import {
  DEEPGRAM_FLUX_PROVIDER,
  DEEPGRAM_TOKEN_GRANT_URL,
  DeepgramConfigError,
  getDeepgramServerConfig
} from "@/lib/deepgram/config";
import { isAllowedRequestOrigin } from "@/lib/http/origin";
import { checkSttTokenGrantRateLimit } from "@/lib/redis/rate-limit";

type DeepgramGrantResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type DeepgramErrorMetadata = {
  errCode?: string;
  errMsg?: string;
};

const deepgramTokenRequestSchema = z.object({
  sessionId: z.string().uuid().optional()
});

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(payload, { ...init, headers });
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

async function readDeepgramErrorMetadata(response: Response): Promise<DeepgramErrorMetadata> {
  try {
    const body = (await response.json()) as { err_code?: unknown; err_msg?: unknown };
    return {
      errCode: typeof body.err_code === "string" ? body.err_code : undefined,
      errMsg: typeof body.err_msg === "string" ? body.err_msg : undefined
    };
  } catch {
    return {};
  }
}

async function parseOptionalTokenRequestBody(request: Request | undefined) {
  if (!request) return {};
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed = deepgramTokenRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function GET() {
  return jsonNoStore({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request?: Request) {
  try {
    if (request && !isAllowedRequestOrigin(request)) {
      console.warn("[deepgram] token origin rejected");
      return jsonNoStore({ error: "Forbidden" }, { status: 403 });
    }

    const user = await getCurrentUserProfile();
    if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

    const parsedBody = await parseOptionalTokenRequestBody(request);
    if (!parsedBody) return jsonNoStore({ error: "Invalid request" }, { status: 400 });

    const premiumUser = await isPremiumUser(user.id);
    if (!premiumUser) return jsonNoStore({ error: "Premium subscription required" }, { status: 403 });

    if (parsedBody.sessionId) {
      const session = await getSessionState(parsedBody.sessionId, user.id);
      if (!session) return jsonNoStore({ error: "Session not found" }, { status: 404 });
      if (session.status !== "active") return jsonNoStore({ error: "Session is not active" }, { status: 400 });
    }

    const rateLimit = await checkSttTokenGrantRateLimit({
      userId: user.id,
      sessionId: parsedBody.sessionId
    });
    if (rateLimit.limited) {
      console.warn(
        `[deepgram] token rate limited userId=${user.id} scope=${rateLimit.scope ?? "unknown"} count=${rateLimit.count ?? "unknown"} max=${rateLimit.max ?? "unknown"} window=${rateLimit.windowSeconds ?? "unknown"}s`
      );
      return jsonNoStore({ error: "Too many token requests" }, { status: 429 });
    }

    let config;
    try {
      config = getDeepgramServerConfig();
    } catch (error) {
      if (error instanceof DeepgramConfigError) {
        console.error(`[deepgram] token config failed userId=${user.id} code=${error.code}`);
        return jsonNoStore({ error: "Deepgram STT is not configured" }, { status: 503 });
      }
      throw error;
    }

    const startedAt = performance.now();
    const grantResponse = await fetch(DEEPGRAM_TOKEN_GRANT_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ttl_seconds: config.ttlSeconds }),
      cache: "no-store"
    });

    if (!grantResponse.ok) {
      const metadata = await readDeepgramErrorMetadata(grantResponse);
      console.error(
        `[deepgram] token grant failed userId=${user.id} provider=${DEEPGRAM_FLUX_PROVIDER} model=${config.model} status=${grantResponse.status} errCode=${metadata.errCode ?? "unknown"} errMsg=${metadata.errMsg ?? "unknown"}`
      );
      return jsonNoStore({ error: "Could not create Deepgram token" }, { status: 502 });
    }

    const grant = (await grantResponse.json()) as DeepgramGrantResponse;
    if (typeof grant.access_token !== "string" || typeof grant.expires_in !== "number") {
      console.error(
        `[deepgram] token grant malformed userId=${user.id} provider=${DEEPGRAM_FLUX_PROVIDER} model=${config.model}`
      );
      return jsonNoStore({ error: "Could not create Deepgram token" }, { status: 502 });
    }

    console.log(
      `[deepgram] token grant success userId=${user.id} provider=${DEEPGRAM_FLUX_PROVIDER} model=${config.model} ttl=${config.ttlSeconds}s ms=${Math.round(performance.now() - startedAt)}`
    );

    return jsonNoStore({
      accessToken: grant.access_token,
      expiresIn: grant.expires_in,
      websocketUrl: config.websocketUrl,
      model: config.model,
      provider: DEEPGRAM_FLUX_PROVIDER
    });
  } catch (error) {
    console.error(`[deepgram] token route failed error=${safeErrorMessage(error)}`);
    return jsonNoStore({ error: "Could not create Deepgram token" }, { status: 500 });
  }
}

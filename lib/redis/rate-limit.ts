import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: cleanEnv(process.env.UPSTASH_REDIS_REST_URL),
      token: cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN)
    });
  }
  return redis;
}

function hasRedisConfig() {
  return Boolean(cleanEnv(process.env.UPSTASH_REDIS_REST_URL) && cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN));
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

type RateLimitResult = {
  limited: boolean;
  configured: boolean;
  scope?: "user" | "session";
  count?: number;
  max?: number;
  windowSeconds?: number;
};

export type ExpensiveEndpointRateLimitKind =
  | "conversation"
  | "analysis"
  | "exercise_generation"
  | "speech_check"
  | "tts"
  | "translation";

export type MonthlyUsageLimitKind =
  | "conversation"
  | "analysis"
  | "exercise_generation"
  | "speech_check"
  | "translation"
  | "tts";

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigurationError";
  }
}

const EXPENSIVE_ENDPOINT_LIMITS: Record<ExpensiveEndpointRateLimitKind, {
  envMax: string;
  envWindow: string;
  fallbackMax: number;
  fallbackWindowSeconds: number;
}> = {
  conversation: {
    envMax: "CONVERSATION_TURNS_PER_USER_PER_WINDOW",
    envWindow: "CONVERSATION_RATE_LIMIT_WINDOW_SECONDS",
    fallbackMax: 5,
    fallbackWindowSeconds: 60
  },
  analysis: {
    envMax: "CONVERSATION_ANALYSES_PER_USER_PER_WINDOW",
    envWindow: "CONVERSATION_ANALYSIS_RATE_LIMIT_WINDOW_SECONDS",
    fallbackMax: 4,
    fallbackWindowSeconds: 60
  },
  exercise_generation: {
    envMax: "EXERCISE_GENERATIONS_PER_USER_PER_WINDOW",
    envWindow: "EXERCISE_GENERATION_RATE_LIMIT_WINDOW_SECONDS",
    fallbackMax: 4,
    fallbackWindowSeconds: 60
  },
  speech_check: {
    envMax: "EXERCISE_SPEECH_CHECKS_PER_USER_PER_WINDOW",
    envWindow: "EXERCISE_SPEECH_CHECK_RATE_LIMIT_WINDOW_SECONDS",
    fallbackMax: 20,
    fallbackWindowSeconds: 60
  },
  tts: {
    envMax: "EXERCISE_TTS_REQUESTS_PER_USER_PER_WINDOW",
    envWindow: "EXERCISE_TTS_RATE_LIMIT_WINDOW_SECONDS",
    fallbackMax: 10,
    fallbackWindowSeconds: 60
  },
  translation: {
    envMax: "TRANSLATION_REQUESTS_PER_USER_PER_WINDOW",
    envWindow: "TRANSLATION_RATE_LIMIT_WINDOW_SECONDS",
    fallbackMax: 10,
    fallbackWindowSeconds: 60
  }
};

const MONTHLY_USAGE_LIMITS: Record<MonthlyUsageLimitKind, {
  envMax: string;
  fallbackMax: number;
}> = {
  conversation: {
    envMax: "MONTHLY_CONVERSATION_TURNS_PER_USER",
    fallbackMax: 600
  },
  analysis: {
    envMax: "MONTHLY_CONVERSATION_ANALYSES_PER_USER",
    fallbackMax: 60
  },
  exercise_generation: {
    envMax: "MONTHLY_EXERCISE_GENERATIONS_PER_USER",
    fallbackMax: 120
  },
  speech_check: {
    envMax: "MONTHLY_EXERCISE_SPEECH_CHECKS_PER_USER",
    fallbackMax: 300
  },
  translation: {
    envMax: "MONTHLY_TRANSLATION_REQUESTS_PER_USER",
    fallbackMax: 300
  },
  tts: {
    envMax: "MONTHLY_EXERCISE_TTS_REQUESTS_PER_USER",
    fallbackMax: 250
  }
};

function assertRateLimitConfigured() {
  if (hasRedisConfig()) return true;
  if (process.env.NODE_ENV === "production") {
    console.error("[rate-limit] Upstash Redis is required in production. Refusing to run without abuse protection.");
    throw new RateLimitConfigurationError("Upstash Redis is required in production");
  }
  return false;
}

async function checkFixedWindowLimit(options: {
  key: string;
  max: number;
  windowSeconds: number;
  scope: "user" | "session";
}): Promise<RateLimitResult> {
  if (!assertRateLimitConfigured()) return { limited: false, configured: false };

  const client = getRedis();
  const count = await client.incr(options.key);
  if (count === 1) await client.expire(options.key, options.windowSeconds);

  return {
    limited: count > options.max,
    configured: true,
    scope: options.scope,
    count,
    max: options.max,
    windowSeconds: options.windowSeconds
  };
}

export function isRateLimitConfigurationError(error: unknown) {
  return error instanceof RateLimitConfigurationError;
}

export async function checkExpensiveEndpointRateLimit(input: {
  userId: string;
  kind: ExpensiveEndpointRateLimitKind;
}): Promise<RateLimitResult> {
  const config = EXPENSIVE_ENDPOINT_LIMITS[input.kind];
  const windowSeconds = parsePositiveInteger(process.env[config.envWindow], config.fallbackWindowSeconds);
  const max = parsePositiveInteger(process.env[config.envMax], config.fallbackMax);

  return checkFixedWindowLimit({
    key: `rate:${input.kind}:user:${input.userId}`,
    max,
    windowSeconds,
    scope: "user"
  });
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function checkMonthlyUsageLimit(input: {
  userId: string;
  kind: MonthlyUsageLimitKind;
}): Promise<RateLimitResult> {
  const config = MONTHLY_USAGE_LIMITS[input.kind];
  const max = parsePositiveInteger(process.env[config.envMax], config.fallbackMax);

  return checkFixedWindowLimit({
    key: `monthly:${input.kind}:${getCurrentMonthKey()}:user:${input.userId}`,
    max,
    windowSeconds: 60 * 60 * 24 * 32,
    scope: "user"
  });
}

export async function checkSttTokenGrantRateLimit(input: {
  userId: string;
  sessionId?: string;
}): Promise<RateLimitResult> {
  const windowSeconds = parsePositiveInteger(process.env.DEEPGRAM_TOKEN_GRANT_RATE_LIMIT_WINDOW_SECONDS, 60);
  const maxUserGrants = parsePositiveInteger(process.env.DEEPGRAM_TOKEN_GRANTS_PER_USER_PER_WINDOW, 12);
  const maxSessionGrants = parsePositiveInteger(process.env.DEEPGRAM_TOKEN_GRANTS_PER_SESSION_PER_WINDOW, 8);

  const userLimit = await checkFixedWindowLimit({
    key: `stt:deepgram:token:user:${input.userId}`,
    max: maxUserGrants,
    windowSeconds,
    scope: "user"
  });
  if (userLimit.limited || !userLimit.configured || !input.sessionId) return userLimit;

  return checkFixedWindowLimit({
    key: `stt:deepgram:token:session:${input.sessionId}`,
    max: maxSessionGrants,
    windowSeconds,
    scope: "session"
  });
}

export async function checkSttMetricsRateLimit(input: {
  userId: string;
}): Promise<RateLimitResult> {
  const windowSeconds = parsePositiveInteger(process.env.STT_METRICS_RATE_LIMIT_WINDOW_SECONDS, 60);
  const max = parsePositiveInteger(process.env.STT_METRICS_PER_USER_PER_WINDOW, 60);

  return checkFixedWindowLimit({
    key: `stt:metrics:user:${input.userId}`,
    max,
    windowSeconds,
    scope: "user"
  });
}

export async function reserveJobSlot(userId: string) {
  const max = Number(process.env.MAX_CONCURRENT_JOBS ?? 3);
  const key = `jobs:active:${userId}`;
  const client = getRedis();
  const count = await client.incr(key);
  await client.expire(key, 60 * 10);
  if (count > max) {
    await client.decr(key);
    throw new Error("RATE_LIMITED");
  }
}

export async function releaseJobSlot(userId: string) {
  const key = `jobs:active:${userId}`;
  const client = getRedis();
  const count = await client.decr(key);
  if (count <= 0) await client.del(key);
}

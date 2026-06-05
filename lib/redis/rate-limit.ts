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

async function checkFixedWindowLimit(options: {
  key: string;
  max: number;
  windowSeconds: number;
  scope: "user" | "session";
}): Promise<RateLimitResult> {
  if (!hasRedisConfig()) return { limited: false, configured: false };

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

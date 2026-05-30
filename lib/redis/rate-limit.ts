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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisState = new Map<string, number>();
const expireMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    async incr(key: string) {
      const next = (redisState.get(key) ?? 0) + 1;
      redisState.set(key, next);
      return next;
    },
    expire: expireMock,
    decr: vi.fn(),
    del: vi.fn()
  }))
}));

describe("rate limits", () => {
  beforeEach(() => {
    redisState.clear();
    expireMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("limits expensive endpoints by user", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("CONVERSATION_TURNS_PER_USER_PER_WINDOW", "2");

    const { checkExpensiveEndpointRateLimit } = await import("@/lib/redis/rate-limit");

    await expect(checkExpensiveEndpointRateLimit({ userId: "user-1", kind: "conversation" })).resolves.toEqual(
      expect.objectContaining({ limited: false, count: 1, max: 2 })
    );
    await expect(checkExpensiveEndpointRateLimit({ userId: "user-1", kind: "conversation" })).resolves.toEqual(
      expect.objectContaining({ limited: false, count: 2, max: 2 })
    );
    await expect(checkExpensiveEndpointRateLimit({ userId: "user-1", kind: "conversation" })).resolves.toEqual(
      expect.objectContaining({ limited: true, count: 3, max: 2 })
    );
  });

  it("does not block local development when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { checkExpensiveEndpointRateLimit, checkMonthlyUsageLimit } = await import("@/lib/redis/rate-limit");

    await expect(checkExpensiveEndpointRateLimit({ userId: "user-1", kind: "tts" })).resolves.toEqual({
      limited: false,
      configured: false
    });
    await expect(checkMonthlyUsageLimit({ userId: "user-1", kind: "translation" })).resolves.toEqual({
      limited: false,
      configured: false
    });
  });

  it("fails closed in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { checkExpensiveEndpointRateLimit, checkMonthlyUsageLimit, RateLimitConfigurationError } = await import(
      "@/lib/redis/rate-limit"
    );

    await expect(checkExpensiveEndpointRateLimit({ userId: "user-1", kind: "tts" })).rejects.toBeInstanceOf(
      RateLimitConfigurationError
    );
    await expect(checkMonthlyUsageLimit({ userId: "user-1", kind: "translation" })).rejects.toBeInstanceOf(
      RateLimitConfigurationError
    );
  });

  it("limits monthly usage by user and kind", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("MONTHLY_TRANSLATION_REQUESTS_PER_USER", "2");

    const { checkMonthlyUsageLimit } = await import("@/lib/redis/rate-limit");

    await expect(checkMonthlyUsageLimit({ userId: "user-1", kind: "translation" })).resolves.toEqual(
      expect.objectContaining({ limited: false, count: 1, max: 2 })
    );
    await expect(checkMonthlyUsageLimit({ userId: "user-1", kind: "translation" })).resolves.toEqual(
      expect.objectContaining({ limited: false, count: 2, max: 2 })
    );
    await expect(checkMonthlyUsageLimit({ userId: "user-1", kind: "translation" })).resolves.toEqual(
      expect.objectContaining({ limited: true, count: 3, max: 2 })
    );
  });

  it("limits STT metrics by user", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("STT_METRICS_PER_USER_PER_WINDOW", "1");

    const { checkSttMetricsRateLimit } = await import("@/lib/redis/rate-limit");

    await expect(checkSttMetricsRateLimit({ userId: "user-1" })).resolves.toEqual(
      expect.objectContaining({ limited: false, count: 1, max: 1 })
    );
    await expect(checkSttMetricsRateLimit({ userId: "user-1" })).resolves.toEqual(
      expect.objectContaining({ limited: true, count: 2, max: 1 })
    );
  });
});

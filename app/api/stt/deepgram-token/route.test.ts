import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isPremiumUser } from "@/lib/billing/tier";
import { getSessionState } from "@/lib/conversation/session-state";
import { checkSttTokenGrantRateLimit } from "@/lib/redis/rate-limit";
import { GET, POST } from "@/app/api/stt/deepgram-token/route";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn()
}));

vi.mock("@/lib/billing/tier", () => ({
  isPremiumUser: vi.fn()
}));

vi.mock("@/lib/conversation/session-state", () => ({
  getSessionState: vi.fn()
}));

vi.mock("@/lib/redis/rate-limit", () => ({
  checkSttTokenGrantRateLimit: vi.fn()
}));

const mockGetCurrentUserProfile = vi.mocked(getCurrentUserProfile);
const mockIsPremiumUser = vi.mocked(isPremiumUser);
const mockGetSessionState = vi.mocked(getSessionState);
const mockCheckSttTokenGrantRateLimit = vi.mocked(checkSttTokenGrantRateLimit);

function mockDeepgramResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("POST /api/stt/deepgram-token", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    process.env.DEEPGRAM_API_KEY = "server-secret";
    process.env.DEEPGRAM_TEMP_TOKEN_TTL_SECONDS = "30";
    process.env.DEEPGRAM_FLUX_MODEL = "flux-general-en";
    delete process.env.DEEPGRAM_FLUX_EOT_THRESHOLD;
    delete process.env.DEEPGRAM_FLUX_EOT_TIMEOUT_MS;
    mockCheckSttTokenGrantRateLimit.mockResolvedValue({ limited: false, configured: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockGetCurrentUserProfile.mockResolvedValue(null);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockIsPremiumUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects GET requests", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ error: "Method not allowed" });
  });

  it("rejects cross-origin token requests", async () => {
    const response = await POST(new Request("http://localhost:3000/api/stt/deepgram-token", {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    }));

    expect(response.status).toBe(403);
    expect(mockGetCurrentUserProfile).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not premium", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(false);

    const response = await POST();

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates the session when sessionId is provided", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(true);
    mockGetSessionState.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      status: "active"
    } as Awaited<ReturnType<typeof getSessionState>>);
    vi.mocked(fetch).mockResolvedValue(mockDeepgramResponse({ access_token: "temporary-token", expires_in: 30 }));

    const response = await POST(new Request("http://localhost:3000/api/stt/deepgram-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ sessionId: "11111111-1111-4111-8111-111111111111" })
    }));

    expect(response.status).toBe(200);
    expect(mockGetSessionState).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "user-1");
    expect(mockCheckSttTokenGrantRateLimit).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "11111111-1111-4111-8111-111111111111"
    });
  });

  it("rate limits token grants before calling Deepgram", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(true);
    mockCheckSttTokenGrantRateLimit.mockResolvedValue({
      limited: true,
      configured: true,
      scope: "user",
      count: 13,
      max: 12,
      windowSeconds: 60
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many token requests" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 503 when Deepgram is not configured", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(true);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Deepgram STT is not configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 502 when Deepgram rejects the token grant", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(true);
    vi.mocked(fetch).mockResolvedValue(mockDeepgramResponse({ error: "bad key" }, 401));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Could not create Deepgram token" });
  });

  it("returns a safe temporary token response for premium users", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(true);
    vi.mocked(fetch).mockResolvedValue(mockDeepgramResponse({ access_token: "temporary-token", expires_in: 30 }));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.deepgram.com/v1/auth/grant",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Token server-secret",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ttl_seconds: 30 }),
        cache: "no-store"
      })
    );
    expect(body).toEqual({
      accessToken: "temporary-token",
      expiresIn: 30,
      websocketUrl: "wss://api.deepgram.com/v2/listen?model=flux-general-en&eot_threshold=0.9&eot_timeout_ms=10000",
      model: "flux-general-en",
      provider: "deepgram_flux"
    });
    expect(JSON.stringify(body)).not.toContain("server-secret");
  });

  it("returns 502 when Deepgram returns a malformed grant response", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockIsPremiumUser.mockResolvedValue(true);
    vi.mocked(fetch).mockResolvedValue(mockDeepgramResponse({ access_token: "temporary-token" }));

    const response = await POST();

    expect(response.status).toBe(502);
  });
});

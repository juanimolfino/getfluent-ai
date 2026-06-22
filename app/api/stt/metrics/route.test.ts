import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSessionState, incrementSttAudioMsUsed } from "@/lib/conversation/session-state";
import { checkSttMetricsRateLimit } from "@/lib/redis/rate-limit";
import { POST } from "@/app/api/stt/metrics/route";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn()
}));

vi.mock("@/lib/conversation/session-state", () => ({
  getSessionState: vi.fn(),
  hasPaidConversationCredit: vi.fn((session: { creditsUsed?: number } | null | undefined) => Boolean(session && (session.creditsUsed ?? 0) >= 1)),
  incrementSttAudioMsUsed: vi.fn()
}));

vi.mock("@/lib/redis/rate-limit", () => ({
  checkSttMetricsRateLimit: vi.fn(),
  isRateLimitConfigurationError: vi.fn(() => false)
}));

const mockGetCurrentUserProfile = vi.mocked(getCurrentUserProfile);
const mockGetSessionState = vi.mocked(getSessionState);
const mockIncrementSttAudioMsUsed = vi.mocked(incrementSttAudioMsUsed);
const mockCheckSttMetricsRateLimit = vi.mocked(checkSttMetricsRateLimit);

function metricRequest(body: unknown) {
  return new Request("http://localhost/api/stt/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/stt/metrics", () => {
  let consoleLog!: ReturnType<typeof vi.spyOn>;
  let consoleError!: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockCheckSttMetricsRateLimit.mockResolvedValue({ limited: false, configured: true });
    mockGetSessionState.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      status: "active",
      creditsUsed: 1
    } as Awaited<ReturnType<typeof getSessionState>>);
    mockIncrementSttAudioMsUsed.mockResolvedValue(3200);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUserProfile.mockResolvedValue(null);

    const response = await POST(metricRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      event: "stt_provider_selected",
      provider: "deepgram_flux"
    }));

    expect(response.status).toBe(401);
    expect(mockGetSessionState).not.toHaveBeenCalled();
  });

  it("rejects cross-origin metric requests", async () => {
    const response = await POST(new Request("http://localhost:3000/api/stt/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({
        sessionId: "11111111-1111-4111-8111-111111111111",
        event: "stt_provider_selected",
        provider: "deepgram_flux"
      })
    }));

    expect(response.status).toBe(403);
    expect(mockGetCurrentUserProfile).not.toHaveBeenCalled();
  });

  it("requires a paid conversation session for Deepgram metrics", async () => {
    mockGetSessionState.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      status: "active",
      creditsUsed: 0
    } as Awaited<ReturnType<typeof getSessionState>>);

    const response = await POST(metricRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      event: "deepgram_end_of_turn",
      provider: "deepgram_flux",
      audioMs: 1000
    }));

    expect(response.status).toBe(402);
    expect(mockIncrementSttAudioMsUsed).not.toHaveBeenCalled();
  });

  it("rate limits metric spam before session lookup", async () => {
    mockCheckSttMetricsRateLimit.mockResolvedValue({
      limited: true,
      configured: true,
      scope: "user",
      count: 61,
      max: 60,
      windowSeconds: 60
    });

    const response = await POST(metricRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      event: "deepgram_end_of_turn",
      provider: "deepgram_flux",
      audioMs: 1000
    }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many metric requests" });
    expect(mockGetSessionState).not.toHaveBeenCalled();
    expect(mockIncrementSttAudioMsUsed).not.toHaveBeenCalled();
  });

  it("logs safe Deepgram final metrics and increments session audio usage", async () => {
    const response = await POST(metricRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      event: "deepgram_end_of_turn",
      provider: "deepgram_flux",
      model: "flux-general-en",
      selectedByFlag: true,
      audioMs: 2400,
      transcriptChars: 64,
      endOfTurnConfidence: 0.91,
      fallbackReason: "access_token=secret",
      errorCode: "api_key=secret"
    }));

    expect(response.status).toBe(202);
    expect(mockIncrementSttAudioMsUsed).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", 2400);

    const logged = consoleLog.mock.calls.flat().join(" ");
    expect(logged).toContain("[stt-summary]");
    expect(logged).toContain("transcriptChars=64");
    expect(logged).toContain("audioMs=2400");
    expect(logged).toContain("fallbackReason=redacted");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("audioBase64");
  });

  it("does not increment usage for non-final events", async () => {
    const response = await POST(metricRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      event: "deepgram_ws_open",
      provider: "deepgram_flux",
      wsOpenMs: 420
    }));

    expect(response.status).toBe(202);
    expect(mockIncrementSttAudioMsUsed).not.toHaveBeenCalled();
  });

  it("accepts batched metrics for one session and increments final audio once", async () => {
    const response = await POST(metricRequest([
      {
        sessionId: "11111111-1111-4111-8111-111111111111",
        event: "deepgram_token_granted",
        provider: "deepgram_flux",
        tokenFetchMs: 120
      },
      {
        sessionId: "11111111-1111-4111-8111-111111111111",
        event: "deepgram_end_of_turn",
        provider: "deepgram_flux",
        audioMs: 1800,
        transcriptChars: 32
      }
    ]));

    expect(response.status).toBe(202);
    expect(mockGetSessionState).toHaveBeenCalledTimes(1);
    expect(mockIncrementSttAudioMsUsed).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", 1800);
  });

  it("rejects batched metrics across sessions", async () => {
    const response = await POST(metricRequest([
      {
        sessionId: "11111111-1111-4111-8111-111111111111",
        event: "deepgram_token_granted",
        provider: "deepgram_flux"
      },
      {
        sessionId: "22222222-2222-4222-8222-222222222222",
        event: "deepgram_ws_open",
        provider: "deepgram_flux"
      }
    ]));

    expect(response.status).toBe(400);
    expect(mockGetSessionState).not.toHaveBeenCalled();
  });

  it("does not log token-shaped fields from rejected payloads", async () => {
    const response = await POST(metricRequest({
      sessionId: "11111111-1111-4111-8111-111111111111",
      event: "deepgram_end_of_turn",
      provider: "deepgram_flux",
      accessToken: "secret-token",
      audioBase64: "secret-audio"
    }));

    expect(response.status).toBe(202);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("secret-token");
    expect(consoleLog.mock.calls.flat().join(" ")).not.toContain("secret-audio");
  });
});

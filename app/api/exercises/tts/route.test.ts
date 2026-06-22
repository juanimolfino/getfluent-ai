import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { textToSpeech } from "@/lib/conversation/elevenlabs";
import { getSessionState } from "@/lib/conversation/session-state";
import { getConversationAnalysisById } from "@/lib/db/fluent-queries";
import { enforceExpensiveEndpointRateLimit, enforceMonthlyUsageLimit } from "@/lib/http/rate-limit";
import { POST } from "@/app/api/exercises/tts/route";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn()
}));

vi.mock("@/lib/conversation/elevenlabs", () => ({
  textToSpeech: vi.fn()
}));

vi.mock("@/lib/conversation/session-state", () => ({
  getSessionState: vi.fn(),
  hasPaidConversationCredit: vi.fn((session: { creditsUsed?: number } | null | undefined) => Boolean(session && (session.creditsUsed ?? 0) >= 1))
}));

vi.mock("@/lib/db/fluent-queries", () => ({
  getConversationAnalysisById: vi.fn()
}));

vi.mock("@/lib/http/rate-limit", () => ({
  enforceExpensiveEndpointRateLimit: vi.fn(),
  enforceMonthlyUsageLimit: vi.fn()
}));

const mockGetCurrentUserProfile = vi.mocked(getCurrentUserProfile);
const mockTextToSpeech = vi.mocked(textToSpeech);
const mockGetSessionState = vi.mocked(getSessionState);
const mockGetConversationAnalysisById = vi.mocked(getConversationAnalysisById);
const mockEnforceExpensiveEndpointRateLimit = vi.mocked(enforceExpensiveEndpointRateLimit);
const mockEnforceMonthlyUsageLimit = vi.mocked(enforceMonthlyUsageLimit);

const validBody = {
  analysisId: "11111111-1111-4111-8111-111111111111",
  weakPointId: "relative-clauses",
  text: "Listen to this sentence."
};

describe("POST /api/exercises/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceExpensiveEndpointRateLimit.mockResolvedValue(null);
    mockEnforceMonthlyUsageLimit.mockResolvedValue(null);
  });

  it("rejects cross-origin requests before auth and TTS", async () => {
    const response = await POST(new Request("http://localhost:3000/api/exercises/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify(validBody)
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(mockGetCurrentUserProfile).not.toHaveBeenCalled();
    expect(mockTextToSpeech).not.toHaveBeenCalled();
  });

  it("allows same-origin TTS requests for a paid conversation session", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockGetConversationAnalysisById.mockResolvedValue({
      id: validBody.analysisId,
      sessionId: "22222222-2222-4222-8222-222222222222",
      weakPoints: [{ id: validBody.weakPointId }]
    } as Awaited<ReturnType<typeof getConversationAnalysisById>>);
    mockGetSessionState.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222", creditsUsed: 1 } as Awaited<ReturnType<typeof getSessionState>>);
    mockTextToSpeech.mockResolvedValue({
      audioBuffer: Buffer.from("audio"),
      contentType: "audio/mpeg"
    });

    const response = await POST(new Request("http://localhost:3000/api/exercises/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify(validBody)
    }));

    expect(response.status).toBe(200);
    expect(mockEnforceExpensiveEndpointRateLimit).toHaveBeenCalledWith({ userId: "user-1", kind: "tts" });
    expect(mockEnforceMonthlyUsageLimit).toHaveBeenCalledWith({ userId: "user-1", kind: "tts" });
    expect(mockTextToSpeech).toHaveBeenCalledWith("Listen to this sentence.");
  });

  it("rejects TTS when the source session has no paid credit", async () => {
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockGetConversationAnalysisById.mockResolvedValue({
      id: validBody.analysisId,
      sessionId: "22222222-2222-4222-8222-222222222222",
      weakPoints: [{ id: validBody.weakPointId }]
    } as Awaited<ReturnType<typeof getConversationAnalysisById>>);
    mockGetSessionState.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222", creditsUsed: 0 } as Awaited<ReturnType<typeof getSessionState>>);

    const response = await POST(new Request("http://localhost:3000/api/exercises/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify(validBody)
    }));

    expect(response.status).toBe(402);
    expect(mockTextToSpeech).not.toHaveBeenCalled();
  });
});

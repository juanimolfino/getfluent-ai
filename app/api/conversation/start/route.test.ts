import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { createPaidSessionState } from "@/lib/conversation/session-state";
import { INSUFFICIENT_CREDITS_ERROR, getUserLanguageProfile } from "@/lib/db/fluent-queries";
import { POST } from "@/app/api/conversation/start/route";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn()
}));

vi.mock("@/lib/conversation/session-state", () => ({
  createPaidSessionState: vi.fn()
}));

vi.mock("@/lib/db/fluent-queries", () => {
  return {
    INSUFFICIENT_CREDITS_ERROR: "INSUFFICIENT_CREDITS",
    getUserLanguageProfile: vi.fn()
  };
});

const mockGetCurrentUserProfile = vi.mocked(getCurrentUserProfile);
const mockCreatePaidSessionState = vi.mocked(createPaidSessionState);
const mockGetUserLanguageProfile = vi.mocked(getUserLanguageProfile);

function startRequest() {
  return new Request("http://localhost:3000/api/conversation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({
      topic: "music",
      targetTurns: 8
    })
  });
}

describe("POST /api/conversation/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserProfile.mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof getCurrentUserProfile>>);
    mockGetUserLanguageProfile.mockResolvedValue({ englishLevel: "A2" } as Awaited<ReturnType<typeof getUserLanguageProfile>>);
  });

  it("creates a paid session after debiting one credit", async () => {
    mockCreatePaidSessionState.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      topic: "music",
      englishLevel: "A2",
      targetTurns: 8
    } as Awaited<ReturnType<typeof createPaidSessionState>>);

    const response = await POST(startRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockCreatePaidSessionState).toHaveBeenCalledWith({
      userId: "user-1",
      englishLevel: "A2",
      topic: "music",
      targetTurns: 8
    });
    expect(body.sessionId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("returns 402 and creates no second session when concurrent starts race with one credit", async () => {
    mockCreatePaidSessionState
      .mockResolvedValueOnce({
        id: "11111111-1111-4111-8111-111111111111",
        topic: "music",
        englishLevel: "A2",
        targetTurns: 8
      } as Awaited<ReturnType<typeof createPaidSessionState>>)
      .mockRejectedValueOnce(new Error(INSUFFICIENT_CREDITS_ERROR));

    const [first, second] = await Promise.all([POST(startRequest()), POST(startRequest())]);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(firstBody.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(second.status).toBe(402);
    expect(secondBody).toEqual({ error: "No credits available" });
    expect(mockCreatePaidSessionState).toHaveBeenCalledTimes(2);
  });

  it("rejects targetTurns above the product maximum", async () => {
    const response = await POST(new Request("http://localhost:3000/api/conversation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({
        topic: "music",
        targetTurns: 30
      })
    }));

    expect(response.status).toBe(400);
    expect(mockCreatePaidSessionState).not.toHaveBeenCalled();
  });
});
